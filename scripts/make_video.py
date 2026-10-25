#!/usr/bin/env python3
"""第 70 步：把 40-cards 的图片和 60-audio 的语音合成讲读视频。

用法: python3 make_video.py <issue 目录>
读:   50-narration.json、60-audio/c{card}_{序号}.wav、40-cards/card-N.png、
      数据目录 sfx/<名字>.wav|mp3（可选音效；sfx/page 是翻页声，sfx/bgm 是垫乐，都可选）
写:   70-final/讲读版.mp4，并把 40-cards 里的 PDF 复制进 70-final/
需要 ffmpeg / ffprobe；hold 提示文字需要带 drawtext 的 ffmpeg 和中文字体，字体用环境变量 FONT 指定，默认自动找。

做法：先把整期的声音拼成一条音轨，记下每页从几秒开始；画面按这些时间点一次编码，
翻页用淡入淡出，新的一页完全出现后才开始说话，所以声音和画面不会越拼越错位。
"""
import json, os, re, shutil, subprocess, sys, tempfile, glob

RATE = 24000
GAP_REPEAT = 0.5   # 同一句重复之间的间隔
GAP_SAME = 0.22    # 同一个角色接着说
GAP_TURN = 0.32    # 换人说话：像接话，不留大段空白
GAP_ASK = 0.6      # 问句后面多停一下，让问题落地
LEAD_IN = 0.4      # 视频开头先静一下
TAIL = 1.2         # 结尾留白
TURN_PAD = 0.25    # 一页说完到开始翻页
FADE = 0.6         # 翻页淡入淡出时长
SETTLE = 0.3       # 新的一页完全出现后，再等一下才开口
TARGET_DB = -20.0  # 每句统一到的平均音量，不同声音之间不再忽大忽小
FPS = 25


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def seconds(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         check=True, capture_output=True, text=True).stdout
    return float(out.strip())


def mean_db(path):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    m = re.search(r"mean_volume: (-?[\d.]+) dB", err)
    return float(m.group(1)) if m else TARGET_DB


def silence(path, sec):
    run("ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=r={RATE}:cl=mono", "-t", f"{sec:.3f}", "-c:a", "pcm_s16le", path)


# 去掉合成语音首尾自带的静音（Azure 每句前后各有一两百毫秒），句间停顿改由下面的规则决定
TRIM = ("silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,"
        "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse")


def prepare(src, dst, slow=False, trim=True):
    tmp = dst + ".tmp.wav"
    flt = (TRIM + "," if trim else "") + ("atempo=0.8," if slow else "") + f"aformat=sample_rates={RATE}:channel_layouts=mono"
    run("ffmpeg", "-y", "-i", src, "-af", flt, "-c:a", "pcm_s16le", tmp)
    gain = max(-12.0, min(12.0, TARGET_DB - mean_db(tmp)))
    run("ffmpeg", "-y", "-i", tmp, "-af", f"volume={gain:.2f}dB,alimiter=limit=0.95", "-c:a", "pcm_s16le", dst)
    os.remove(tmp)


def find_sfx(issue, name):
    # 音效放在数据目录的 sfx/ 下；issue 目录是 数据目录/issues/NNN
    if not name:
        return None
    base = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(issue))), "sfx")
    for ext in (".wav", ".mp3", ".m4a", ".ogg"):
        f = os.path.join(base, name + ext)
        if os.path.exists(f):
            return f
    return None


def has_drawtext():
    out = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True).stdout
    return re.search(r"\sdrawtext\s", out) is not None


def find_font():
    if os.environ.get("FONT"):
        return os.environ["FONT"]
    try:  # 先问系统：哪个字体支持中文
        f = subprocess.run(["fc-match", "-f", "%{file}", "sans:lang=zh-cn"], capture_output=True, text=True).stdout.strip()
        if f and os.path.exists(f):
            return f
    except FileNotFoundError:
        pass
    for pat in ["/usr/share/fonts/**/NotoSansCJK*.tt*", "/usr/share/fonts/**/*CJK*.tt*", "/usr/share/fonts/**/wqy*.tt*",
                "/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/STHeiti Medium.ttc"]:
        hits = glob.glob(pat, recursive=True)
        if hits:
            return hits[0]
    return None


def plain(text):
    # drawtext 画不出 emoji，去掉补充平面字符和常见符号
    return re.sub(r"[\U00010000-\U0010FFFF☀-➿⏩-⏺️]", "", text).strip()


def gap_after(line, nxt):
    """句子念完后停多久：写了 pause 就按写的；没写就按对话节奏自动定。"""
    if "pause" in line:
        return float(line["pause"])
    if nxt is None:
        return 0.0
    if re.search(r"[?？]\s*$", line["text"]):
        return GAP_ASK
    return GAP_SAME if nxt["who"] == line["who"] else GAP_TURN


class Track:
    """按顺序往一条音轨上放片段，同时记时间。"""

    def __init__(self, tmp):
        self.tmp, self.pieces, self.t, self.n = tmp, [], 0.0, 0

    def add(self, path):
        self.pieces.append(path)
        self.t += seconds(path)

    def gap(self, sec):
        if sec <= 0:
            return
        self.n += 1
        p = os.path.join(self.tmp, f"gap_{self.n}.wav")
        silence(p, sec)
        self.pieces.append(p)
        self.t += sec

    def write(self, out):
        lst = os.path.join(self.tmp, "track.txt")
        open(lst, "w").write("".join(f"file '{p}'\n" for p in self.pieces))
        run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:a", "pcm_s16le", out)


def main(issue):
    issue = os.path.abspath(issue)
    scripts = os.path.dirname(os.path.abspath(__file__))
    node = os.environ.get("NODE", "node")
    build_inputs = subprocess.check_output([node, os.path.join(scripts, "pipeline.mjs"), "video-inputs", issue], text=True).strip()
    nar = json.load(open(os.path.join(issue, "50-narration.json")))["narration"]
    audio_dir, cards_dir = os.path.join(issue, "60-audio"), os.path.join(issue, "40-cards")
    final = tempfile.mkdtemp(prefix=".kids-video-", dir=issue)
    tmp = tempfile.mkdtemp(prefix="narrate-")

    try:
        page_fx = find_sfx(issue, "page")
        if page_fx:
            p = os.path.join(tmp, "page.wav"); prepare(page_fx, p, trim=False); page_fx = p

        track, holds, starts = Track(tmp), [], []
        track.gap(LEAD_IN)
        for k, page in enumerate(nar):
            card = page["card"]
            if k:
                # 翻页：说完 → 停一下 → 淡入淡出 → 新页完全出现 → 再停一下才开口
                track.gap(TURN_PAD)
                starts.append(track.t)
                turn = FADE + SETTLE
                if page_fx and seconds(page_fx) < turn:
                    track.add(page_fx); track.gap(turn - seconds(page_fx))
                else:
                    track.gap(turn)
            else:
                starts.append(0.0)
            lines = page["lines"]
            for i, line in enumerate(lines):
                sfx = find_sfx(issue, line.get("sfx"))
                if sfx:
                    fx = os.path.join(tmp, f"sfx_{card}_{i}.wav"); prepare(sfx, fx, trim=False)
                    track.add(fx); track.gap(0.15)
                src = os.path.join(audio_dir, f"c{card}_{i:02d}.wav")
                if not os.path.exists(src):
                    sys.exit(f"缺少音频 {src}")
                clip = os.path.join(tmp, f"c{card}_{i:02d}.wav")
                prepare(src, clip, slow=line.get("rate") == "slow")
                for r in range(int(line.get("repeat", 1))):
                    if r:
                        track.gap(GAP_REPEAT)
                    track.add(clip)
                pause = gap_after(line, lines[i + 1] if i + 1 < len(lines) else None)
                if line.get("hold") and pause > 0:
                    holds.append((track.t, track.t + pause, plain(line["hold"])))
                track.gap(pause)
        track.gap(TAIL)
        total = track.t
        voice = os.path.join(tmp, "voice.wav")
        track.write(voice)

        # 垫乐（可选）：sfx/bgm 循环铺在底下，音量很低，首尾淡入淡出
        audio_in, audio_map = ["-i", voice], "1:a"
        bgm = find_sfx(issue, "bgm")
        afilter = None
        if bgm:
            audio_in += ["-stream_loop", "-1", "-i", bgm]
            afilter = (f"[2:a]aformat=sample_rates={RATE}:channel_layouts=mono,volume=-26dB,atrim=0:{total:.3f},"
                       f"afade=t=in:d=2,afade=t=out:st={max(0, total - 3):.3f}:d=3[bg];[1:a][bg]amix=inputs=2:duration=first:normalize=0[aout]")
            audio_map = "[aout]"

        # 画面：每页一张图，在 starts 的时间点开始淡入淡出到下一页；一次编码，和音轨严格对齐
        n = len(nar)
        inputs, vf = [], []
        for k, page in enumerate(nar):
            end = starts[k + 1] + FADE if k + 1 < n else total
            dur = end - starts[k]
            inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", os.path.join(cards_dir, f"card-{page['card']}.png")]
        for k in range(n):
            vf.append(f"[{k}:v]scale=1080:1440,setsar=1,format=yuv420p,fps={FPS}[v{k}]")
        last = "v0"
        for k in range(1, n):
            vf.append(f"[{last}][v{k}]xfade=transition=fade:duration={FADE}:offset={starts[k]:.3f}[x{k}]")
            last = f"x{k}"
        font = find_font() if holds else None
        drawn = bool(holds and font and has_drawtext())
        if drawn:
            # hold 提示放在顶部刊名/标题区，避开封面问题和页面正文
            texts = []
            for a, b, txt in holds:
                safe = txt.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’")
                texts.append(f"drawtext=fontfile='{font}':text='{safe}':fontsize=56:fontcolor=white:box=1:boxcolor=0x4A3B32CC:"
                             f"boxborderw=24:x=(w-text_w)/2:y=170:enable='between(t,{a:.2f},{b:.2f})'")
            vf.append(f"[{last}]{','.join(texts)}[vout]")
            last = "vout"

        # 音频输入排在所有图片之后，下标从 n 开始
        graph = ";".join(vf)
        if afilter:
            graph += ";" + afilter.replace("[1:a]", f"[{n}:a]").replace("[2:a]", f"[{n + 1}:a]")
        else:
            audio_map = f"{n}:a"
        out = os.path.join(final, "讲读版.mp4")
        run("ffmpeg", "-y", *inputs, *audio_in, "-filter_complex", graph, "-map", f"[{last}]", "-map", audio_map,
            "-c:v", "libx264", "-tune", "stillimage", "-preset", "veryfast", "-r", str(FPS),
            "-c:a", "aac", "-b:a", "128k", "-t", f"{total:.3f}", "-movflags", "+faststart", out)
        for pdf in glob.glob(os.path.join(cards_dir, "*.pdf")):
            shutil.copy(pdf, final)
        note = ""
        if holds and not drawn:
            note = "（hold 提示没有画上：" + ("没找到中文字体，设置 FONT 环境变量" if not font else "这个 ffmpeg 不带 drawtext") + "）"
        subprocess.run([node, os.path.join(scripts, "build-state.mjs"), "finish-video", issue, "70-video", build_inputs, final], check=True)
        out = os.path.join(issue, "70-final", "讲读版.mp4")
        print(f"{out}  {total / 60:.1f} 分钟；翻页时间点 " + " ".join(f"{s:.1f}s" for s in starts[1:]) + note)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        shutil.rmtree(final, ignore_errors=True)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("用法: python3 make_video.py <issue 目录>")
    main(sys.argv[1])
