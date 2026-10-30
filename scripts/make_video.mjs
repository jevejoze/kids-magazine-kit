#!/usr/bin/env node
// 第 70 步：把 cards 的图片和 audio 的语音合成讲读视频（Node 22+ 零依赖版）。
// 用法: node scripts/make_video.mjs <issue 目录>
// 读:   narration.json、audio/c{card}_{序号}.wav、cards/card-N.png、
//       数据目录 sfx/<名字>.wav|mp3（可选音效；sfx/page 是翻页声，sfx/bgm 是垫乐，都可选）
// 写:   final/讲读版.mp4，并把 cards 里的 PDF 复制进 final/
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync, copyFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createPipeline } from "./pipeline-lib.mjs";
import { inputFingerprint, recordBuild, publishDirectory } from "./build-state.mjs";

const RATE = 24000;
const GAP_REPEAT = 0.5;   // 同一句重复之间的间隔
const GAP_SAME = 0.22;    // 同一个角色接着说
const GAP_TURN = 0.32;    // 换人说话：像接话，不留大段空白
const GAP_ASK = 0.6;      // 问句后面多停一下，让问题落地
const LEAD_IN = 0.4;      // 视频开头先静一下
const TAIL = 1.2;         // 结尾留白
const TURN_PAD = 0.25;    // 一页说完到开始翻页
const FADE = 0.6;         // 翻页淡入淡出时长
const SETTLE = 0.3;       // 新的一页完全出现后，再等一下才开口
const TARGET_DB = -20.0;  // 每句统一到的平均音量，不同声音之间不再忽大忽小
const FPS = 25;

const TRIM = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse," +
             "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse";

const run = (...args) => execFileSync(args[0], args.slice(1), { stdio: ["ignore", "ignore", "pipe"] });

function seconds(path) {
  if (path.endsWith(".wav")) {
    const buf = readFileSync(path);
    const idx = buf.indexOf("data", 12, "ascii");
    if (idx > 0 && idx + 8 <= buf.length) return buf.readUInt32LE(idx + 4) / (RATE * 2);
  }
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], { encoding: "utf8" });
  return parseFloat(out.trim());
}

function meanDb(path) {
  const res = spawnSync("ffmpeg", ["-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const m = (res.stderr || "").match(/mean_volume:\s*(-?[\d.]+)\s*dB/);
  return m ? parseFloat(m[1]) : TARGET_DB;
}

// 内存直接生成 24kHz 16-bit 单声道静音 WAV，免去每次启动 ffmpeg 子进程
function silence(path, sec) {
  const dataBytes = Math.round(sec * RATE) * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);
  writeFileSync(path, buf);
}

function prepare(src, dst, slow = false, trim = true) {
  const tmp = `${dst}.tmp.wav`;
  const flt = `${trim ? TRIM + "," : ""}${slow ? "atempo=0.8," : ""}aformat=sample_rates=${RATE}:channel_layouts=mono`;
  run("ffmpeg", "-y", "-i", src, "-af", flt, "-c:a", "pcm_s16le", "-bitexact", tmp);
  const gain = Math.max(-12.0, Math.min(12.0, TARGET_DB - meanDb(tmp)));
  run("ffmpeg", "-y", "-i", tmp, "-af", `volume=${gain.toFixed(2)}dB,alimiter=limit=0.95`, "-c:a", "pcm_s16le", "-bitexact", dst);
  rmSync(tmp, { force: true });
}

function findSfx(issue, name) {
  if (!name) return null;
  const base = join(dirname(dirname(resolve(issue))), "sfx");
  for (const ext of [".wav", ".mp3", ".m4a", ".ogg"]) {
    const f = join(base, name + ext);
    if (existsSync(f)) return f;
  }
  return null;
}

function hasDrawtext() {
  const res = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return /\sdrawtext\s/.test(res.stdout || "");
}

function findFont() {
  if (process.env.FONT && existsSync(process.env.FONT)) return process.env.FONT;
  const fc = spawnSync("fc-match", ["-f", "%{file}", "sans:lang=zh-cn"], { encoding: "utf8" });
  if (fc.status === 0 && fc.stdout.trim() && existsSync(fc.stdout.trim())) return fc.stdout.trim();
  for (const f of ["/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/STHeiti Medium.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"]) {
    if (existsSync(f)) return f;
  }
  return null;
}

const plain = text => String(text ?? "").replace(/[\u{10000}-\u{10FFFF}\u2600-\u27BF\u23E9-\u23FA\uFE0F]/gu, "").trim();

function gapAfter(line, nxt) {
  if ("pause" in line) return Number(line.pause);
  if (!nxt) return 0.0;
  if (/[?？]\s*$/.test(line.text)) return GAP_ASK;
  return nxt.who === line.who ? GAP_SAME : GAP_TURN;
}

class Track {
  constructor(tmp) {
    this.tmp = tmp; this.pieces = []; this.t = 0.0; this.n = 0;
  }
  add(path) {
    this.pieces.push(path);
    this.t += seconds(path);
  }
  gap(sec) {
    if (sec <= 0) return;
    this.n += 1;
    const p = join(this.tmp, `gap_${this.n}.wav`);
    silence(p, sec);
    this.pieces.push(p);
    this.t += sec;
  }
  write(out) {
    const lst = join(this.tmp, "track.txt");
    writeFileSync(lst, this.pieces.map(p => `file '${p}'\n`).join(""));
    run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:a", "pcm_s16le", "-bitexact", out);
  }
}

const issueArg = process.argv[2];
if (!issueArg) { console.error("用法: node scripts/make_video.mjs <issue 目录>"); process.exit(1); }
const issue = resolve(issueArg);
const pipeline = createPipeline(issue);
if (!["render", "audio"].every(stage => pipeline.done(stage))) {
  console.error("页图或音频未完成、已过期，请重新制作后再合成视频");
  process.exit(2);
}
const buildInputs = inputFingerprint(issue, "video");
const nar = JSON.parse(readFileSync(join(issue, "narration.json"), "utf8")).narration;
const audioDir = join(issue, "audio"), cardsDir = join(issue, "cards");
const stagingDir = mkdtempSync(join(issue, ".kids-video-"));
const tmp = mkdtempSync(join(tmpdir(), "narrate-"));

try {
  let pageFx = findSfx(issue, "page");
  if (pageFx) {
    const p = join(tmp, "page.wav");
    prepare(pageFx, p, false, false);
    pageFx = p;
  }

  const track = new Track(tmp), holds = [], starts = [];
  track.gap(LEAD_IN);
  for (const [k, page] of nar.entries()) {
    const card = page.card;
    if (k) {
      track.gap(TURN_PAD);
      starts.push(track.t);
      const turn = FADE + SETTLE;
      if (pageFx && seconds(pageFx) < turn) {
        track.add(pageFx);
        track.gap(turn - seconds(pageFx));
      } else {
        track.gap(turn);
      }
    } else {
      starts.push(0.0);
    }
    const lines = page.lines;
    for (const [i, line] of lines.entries()) {
      const sfx = findSfx(issue, line.sfx);
      if (sfx) {
        const fx = join(tmp, `sfx_${card}_${i}.wav`);
        prepare(sfx, fx, false, false);
        track.add(fx);
        track.gap(0.15);
      }
      const src = join(audioDir, `c${card}_${String(i).padStart(2, "0")}.wav`);
      if (!existsSync(src)) { console.error(`缺少音频 ${src}`); process.exit(1); }
      const clip = join(tmp, `c${card}_${String(i).padStart(2, "0")}.wav`);
      prepare(src, clip, line.rate === "slow");
      const rep = Number(line.repeat || 1);
      for (let r = 0; r < rep; r++) {
        if (r) track.gap(GAP_REPEAT);
        track.add(clip);
      }
      const pause = gapAfter(line, lines[i + 1] ?? null);
      if (line.hold && pause > 0) holds.push([track.t, track.t + pause, plain(line.hold)]);
      track.gap(pause);
    }
  }
  track.gap(TAIL);
  const total = track.t;
  const voice = join(tmp, "voice.wav");
  track.write(voice);

  const audioIn = ["-i", voice];
  let audioMap = "1:a", afilter = null;
  const bgm = findSfx(issue, "bgm");
  if (bgm) {
    audioIn.push("-stream_loop", "-1", "-i", bgm);
    afilter = `[2:a]aformat=sample_rates=${RATE}:channel_layouts=mono,volume=-26dB,atrim=0:${total.toFixed(3)},` +
              `afade=t=in:d=2,afade=t=out:st=${Math.max(0, total - 3).toFixed(3)}:d=3[bg];[1:a][bg]amix=inputs=2:duration=first:normalize=0[aout]`;
    audioMap = "[aout]";
  }

  const n = nar.length, inputs = [], vf = [];
  for (const [k, page] of nar.entries()) {
    const end = k + 1 < n ? starts[k + 1] + FADE : total;
    const dur = end - starts[k];
    inputs.push("-loop", "1", "-framerate", String(FPS), "-t", dur.toFixed(3), "-i", join(cardsDir, `card-${page.card}.png`));
  }
  for (let k = 0; k < n; k++) vf.push(`[${k}:v]scale=1080:1440,setsar=1,format=yuv420p,fps=${FPS}[v${k}]`);
  let last = "v0";
  for (let k = 1; k < n; k++) {
    vf.push(`[${last}][v${k}]xfade=transition=fade:duration=${FADE}:offset=${starts[k].toFixed(3)}[x${k}]`);
    last = `x${k}`;
  }
  const font = holds.length ? findFont() : null;
  const drawn = Boolean(holds.length && font && hasDrawtext());
  if (drawn) {
    const texts = holds.map(([a, b, txt]) => {
      const safe = txt.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "’");
      return `drawtext=fontfile='${font}':text='${safe}':fontsize=56:fontcolor=white:box=1:boxcolor=0x4A3B32CC:` +
             `boxborderw=24:x=(w-text_w)/2:y=170:enable='between(t,${a.toFixed(2)},${b.toFixed(2)})'`;
    });
    vf.push(`[${last}]${texts.join(",")}[vout]`);
    last = "vout";
  }

  let graph = vf.join(";");
  if (afilter) graph += ";" + afilter.replace("[1:a]", `[${n}:a]`).replace("[2:a]", `[${n + 1}:a]`);
  else audioMap = `${n}:a`;

  const out = join(stagingDir, "讲读版.mp4");
  run("ffmpeg", "-y", ...inputs, ...audioIn, "-filter_complex", graph, "-map", `[${last}]`, "-map", audioMap,
      "-c:v", "libx264", "-tune", "stillimage", "-preset", "veryfast", "-r", String(FPS),
      "-c:a", "aac", "-b:a", "128k", "-t", total.toFixed(3), "-movflags", "+faststart", out);
  if (existsSync(cardsDir)) {
    for (const f of readdirSync(cardsDir)) if (f.endsWith(".pdf")) copyFileSync(join(cardsDir, f), join(stagingDir, f));
  }
  recordBuild(issue, "video", buildInputs, readdirSync(stagingDir).filter(p => p.endsWith(".mp4") || p.endsWith(".pdf")).map(p => join(stagingDir, p)), stagingDir);
  publishDirectory(stagingDir, join(issue, "final"), name => name === "讲读版.mp4" || name === "build.json" || /-第\d+期\.pdf$/.test(name));
  let note = "";
  if (holds.length && !drawn) note = `（hold 提示没有画上：${!font ? "没找到中文字体，设置 FONT 环境变量" : "这个 ffmpeg 不带 drawtext"}）`;
  console.log(`${join(issue, "final", "讲读版.mp4")}  ${(total / 60).toFixed(1)} 分钟；翻页时间点 ${starts.slice(1).map(s => `${s.toFixed(1)}s`).join(" ")}${note}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
  rmSync(stagingDir, { recursive: true, force: true });
}
