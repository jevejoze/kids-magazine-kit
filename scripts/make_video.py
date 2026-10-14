#!/usr/bin/env python3
"""第 70 步：把 40-cards 的图片和 60-audio 的语音合成讲读视频。

用法: python3 make_video.py <issue 目录>
读:   50-narration.json、60-audio/c{card}_{序号}.wav、40-cards/card-N.png、数据目录 sfx/<名字>.wav|mp3（可选音效）
写:   70-final/讲读版.mp4，并把 40-cards 里的 PDF 复制进 70-final/
需要 ffmpeg / ffprobe；hold 提示文字需要中文字体，用环境变量 FONT 指定，默认自动找 Noto CJK。
"""
import json, os, re, shutil, subprocess, sys, tempfile, glob

GAP_REPEAT = 0.5  # 同一句重复之间的间隔（秒）


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def seconds(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         check=True, capture_output=True, text=True).stdout
    return float(out.strip())


def silence(path, sec):
    run("ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", f"{sec:.3f}", path)


def normalize(src, dst, slow):
    flt = "atempo=0.8," if slow else ""
    run("ffmpeg", "-y", "-i", src, "-af", f"{flt}aformat=sample_rates=24000:channel_layouts=mono", dst)


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


def main(issue):
    nar = json.load(open(os.path.join(issue, "50-narration.json")))["narration"]
    audio_dir, cards_dir = os.path.join(issue, "60-audio"), os.path.join(issue, "40-cards")
    final = os.path.join(issue, "70-final")
    os.makedirs(final, exist_ok=True)
    font = find_font()
    tmp = tempfile.mkdtemp(prefix="narrate-")
    parts = []
    for page in nar:
        card = page["card"]
        pieces, holds, t = [], [], 0.0
        for i, line in enumerate(page["lines"]):
            sfx = find_sfx(issue, line.get("sfx"))
            if sfx:
                fx = os.path.join(tmp, f"sfx_{card}_{i}.wav"); normalize(sfx, fx, False)
                pieces.append(fx); t += seconds(fx)
            src = os.path.join(audio_dir, f"c{card}_{i:02d}.wav")
            if not os.path.exists(src):
                sys.exit(f"缺少音频 {src}")
            norm = os.path.join(tmp, f"c{card}_{i:02d}.wav")
            normalize(src, norm, line.get("rate") == "slow")
            d = seconds(norm)
            for r in range(int(line.get("repeat", 1))):
                if r:
                    gap = os.path.join(tmp, f"gap_{card}_{i}_{r}.wav"); silence(gap, GAP_REPEAT)
                    pieces.append(gap); t += GAP_REPEAT
                pieces.append(norm); t += d
            pause = float(line.get("pause", 0.6))
            if pause > 0:
                sil = os.path.join(tmp, f"sil_{card}_{i}.wav"); silence(sil, pause)
                pieces.append(sil)
                if line.get("hold"):
                    holds.append((t, t + pause, plain(line["hold"])))
                t += pause
        lst = os.path.join(tmp, f"card{card}.txt")
        open(lst, "w").write("".join(f"file '{p}'\n" for p in pieces))
        wav = os.path.join(tmp, f"card{card}.wav")
        run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", wav)

        vf = ["scale=1080:1440,format=yuv420p"]
        if font:
            for a, b, txt in holds:
                safe = txt.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’")
                vf.append(f"drawtext=fontfile='{font}':text='{safe}':fontsize=56:fontcolor=white:box=1:boxcolor=0x4A3B32CC:"
                          f"boxborderw=24:x=(w-text_w)/2:y=h-260:enable='between(t,{a:.2f},{b:.2f})'")
        mp4 = os.path.join(tmp, f"card{card}.mp4")
        run("ffmpeg", "-y", "-loop", "1", "-framerate", "10", "-i", os.path.join(cards_dir, f"card-{card}.png"), "-i", wav,
            "-vf", ",".join(vf), "-c:v", "libx264", "-tune", "stillimage", "-preset", "veryfast", "-r", "10",
            "-c:a", "aac", "-b:a", "96k", "-shortest", mp4)
        parts.append(mp4)

    lst = os.path.join(tmp, "all.txt")
    open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    out = os.path.join(final, "讲读版.mp4")
    run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", out)
    for pdf in glob.glob(os.path.join(cards_dir, "*.pdf")):
        shutil.copy(pdf, final)
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"{out}  {seconds(out) / 60:.1f} 分钟" + ("" if font else "（没找到中文字体，hold 提示没有画上，设置 FONT 环境变量）"))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("用法: python3 make_video.py <issue 目录>")
    main(sys.argv[1])
