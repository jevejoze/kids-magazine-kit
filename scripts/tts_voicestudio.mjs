#!/usr/bin/env node
// 第 60 步的克隆声音：Azure 或 MiMo 合成完整期之后，把指定角色的句子换成 VoiceStudio（OmniVoice）克隆的声音。需要 Node 22+ 和 ffmpeg。
//   node scripts/tts_voicestudio.mjs <issue 目录>          替换整期（已经替换过、正文没变的句子跳过，可随时中断重跑）
//   node scripts/tts_voicestudio.mjs <issue 目录> --dry    只列出要替换几句，不调用 VoiceStudio
// 环境变量：VOICESTUDIO_URL（默认 http://127.0.0.1:3900，远程机器可用 ssh -L 转到本地）
// 配置：数据目录 voices/voicestudio.json，没有这个文件就什么都不做
//   {"narrator/zh": "parent", "narrator/zh@serial": "parent-reading",
//    "profiles": {"parent": ["本机 id", "另一台机器的 id"], "parent-reading": ["本机 id"]}}
//   键是 角色/语言，加 @serial 表示只用于经典连载（读书）那一页；值是档案名。
//   profiles 写每个档案在各台 VoiceStudio 上的 id，按顺序试，哪台机器上有就用哪个；参照音频在 voices/clone/<档案名>/
// 单句失败保留原来合成的版本，不阻塞出刊；VoiceStudio 连不上时退出码 3，原来的整期照样可用
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { pageOrder } from "./contracts.mjs";
import { inputFingerprint, recordBuild, atomicWrite } from "./build-state.mjs";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const target = args.find(a => !a.startsWith("--"));
if (!target) { console.error("用法: node tts_voicestudio.mjs <issue 目录> [--dry]"); process.exit(1); }

const issue = resolve(target), dataDir = resolve(issue, "..", "..");
const confFile = join(dataDir, "voices", "voicestudio.json");
if (!existsSync(confFile)) { console.log("没有 voices/voicestudio.json，不用克隆声音"); process.exit(0); }
const conf = JSON.parse(readFileSync(confFile, "utf8"));
const URL_ = (process.env.VOICESTUDIO_URL || "http://127.0.0.1:3900").replace(/\/$/, "");

const outDir = join(issue, "60-audio"), manPath = join(outDir, "manifest.json");
if (!existsSync(manPath) || JSON.parse(readFileSync(manPath, "utf8"))._meta?.complete === false) {
  console.error("先跑完整期合成：node scripts/tts_azure.mjs <issue>（数据目录有 voices/mimo.json 时用 tts_mimo.mjs）"); process.exit(1);
}
const inputs = inputFingerprint(issue, "60-audio");
const man = JSON.parse(readFileSync(manPath, "utf8"));
const nar = JSON.parse(readFileSync(join(issue, "50-narration.json"), "utf8")).narration;
const data = JSON.parse(readFileSync(join(issue, "30-issue.json"), "utf8"));
// 连载页按渲染顺序定位；周五的音乐盒、放映室、动手做不算
const serialCard = data.serial && (data.serial.kind ?? "book") === "book" ? pageOrder(data).indexOf("serial") + 1 : 0;

const plain = s => s.replace(/<[^>]+>/g, "");
const sha1 = s => createHash("sha1").update(s).digest("hex").slice(0, 12);
const audioHash = wav => createHash("sha256").update(wav).digest("hex");
const profileOf = (line, card) => (card === serialCard && conf[`${line.who}/${line.lang}@serial`]) || conf[`${line.who}/${line.lang}`];

const byFile = Object.fromEntries(man.files.map(f => [f.file, f]));
const todo = [];
let kept = 0;
for (const page of nar) page.lines.forEach((line, i) => {
  const profile = profileOf(line, page.card);
  if (!profile) return;
  const file = `c${page.card}_${String(i).padStart(2, "0")}.wav`, entry = byFile[file], text = plain(line.text);
  if (!entry) throw new Error(`manifest 里没有 ${file}，先重跑整期合成`);
  const done = entry.by === `VoiceStudio-${profile}` && entry.vs_text_sha === sha1(text) && existsSync(join(outDir, file));
  // 早先的替换脚本没更新 audio_hash，重跑 Azure 时会把克隆句覆盖回去，这里补上
  if (done) { kept++; entry.audio_hash = audioHash(readFileSync(join(outDir, file))); }
  else todo.push({ file, entry, text, lang: line.lang, profile });
});
const chars = todo.reduce((n, t) => n + [...t.text].length, 0);
console.log(`克隆声音 ${todo.length + kept} 句：已替换可跳过 ${kept} 句，要合成 ${todo.length} 句（${chars} 字）`);
if (dry || !todo.length) { if (!dry) finish(); process.exit(0); }

try {
  const res = await fetch(`${URL_}/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
} catch (e) { console.error(`VoiceStudio 连不上（${URL_}）：${e.message}。原来合成的音频照样可用`); process.exit(3); }

const ids = {};  // 档案名 → 这台机器上能用的 id
async function generate(profile, lang, text) {
  const tried = ids[profile] ? [ids[profile]] : conf.profiles?.[profile] ?? [];
  if (!tried.length) throw new Error(`voicestudio.json 的 profiles 里没有 ${profile}`);
  let last;
  for (const id of tried) {
    const form = new FormData();
    form.set("profile_id", id); form.set("language", lang); form.set("text", text);
    const res = await fetch(`${URL_}/generate`, { method: "POST", body: form });
    if (res.ok) { ids[profile] = id; return Buffer.from(await res.arrayBuffer()); }
    last = `HTTP ${res.status} ${(await res.text()).slice(0, 120)}`;
    if (res.status >= 500) break;  // 服务端出错，换 id 也没用
  }
  throw new Error(last);
}
// 统一成和 Azure、MiMo 一样的 24kHz 16 位单声道
function normalize(wav) {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  try {
    writeFileSync(join(dir, "a.wav"), wav);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", join(dir, "a.wav"), "-ar", "24000", "-ac", "1", "-sample_fmt", "s16", "-bitexact", join(dir, "b.wav")]);
    return readFileSync(join(dir, "b.wav"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
function seconds(wav) {
  const i = wav.indexOf("data", 12, "ascii");
  return (i > 0 ? wav.readUInt32LE(i + 4) : wav.length - 44) / (24000 * 2);
}
let failed = 0, n = 0;
const started = Date.now();
for (const t of todo) {
  n++;
  try {
    const wav = normalize(await generate(t.profile, t.lang, t.text));
    atomicWrite(join(outDir, t.file), wav);
    Object.assign(t.entry, { seconds: +seconds(wav).toFixed(2), audio_hash: audioHash(wav), by: `VoiceStudio-${t.profile}`, vs_text_sha: sha1(t.text) });
    save(false);
    const left = (Date.now() - started) / n * (todo.length - n) / 60000;
    console.log(`${n}/${todo.length} ${t.file} ${t.profile}，预计还要 ${left.toFixed(0)} 分钟`);
  } catch (e) { failed++; console.warn(`${n}/${todo.length} ${t.file} 失败，保留原版：${e.message}`); }
}
finish();
console.log(`完成：替换 ${todo.length - failed} 句，跳过 ${kept} 句${failed ? `，${failed} 句失败保留原版（重跑可补）` : ""}`);

function save(complete) {
  atomicWrite(manPath, JSON.stringify({ ...man, _meta: { ...man._meta, by: `${(man._meta.by ?? "Azure 语音").replace(/ \+ VoiceStudio$/, "")} + VoiceStudio`, at: new Date().toISOString(), complete } }, null, 2));
}
function finish() {
  for (const key of Object.keys(conf)) if (key.includes("/")) man.voices[key.replace("@serial", "（连载）")] = `VoiceStudio ${conf[key]}`;
  save(true);
  recordBuild(issue, "60-audio", inputs, [manPath, ...man.files.map(f => join(outDir, f.file))]);
}
