#!/usr/bin/env node
// 第 60 步的角色声音：Azure 或 MiMo 合成完整期之后，把指定角色的句子换成 ElevenLabs（Eleven v3）的声音。需要 Node 22+ 和 ffmpeg。
//   node scripts/tts_elevenlabs.mjs <issue 目录>          替换整期（已经替换过、正文和声音没变的句子跳过，可随时中断重跑）
//   node scripts/tts_elevenlabs.mjs <issue 目录> --dry    只列出要替换几句、预计用多少字符，不调用 ElevenLabs
// 环境变量：ELEVENLABS_API_KEY
// 配置：数据目录 voices/elevenlabs.json，没有这个文件就什么都不做
//   {"model": "eleven_v3", "dog/zh": {"name": "tuanzi-dog", "voice_id": "…"}, "owl/zh": {"name": "gugu-owl", "voice_id": "…", "speed": 1.1},
//    "tags": {"困倦": "[yawns]"}}
//   键是 角色/语言，加 @serial 表示只用于经典连载（读书）那一页；name 是 My Voices 里的声音名，voice_id 是它的 ID；
//   stability 是 v3 的稳定度（0 创意、0.5 自然、1 稳定，默认 0.5）；pitch 合成后升降半音，speed 合成后调语速（音高不变）
//   tags 覆盖下面 TAGS 里 emotion 对应的 v3 音频标签，写空字符串表示这种语气不加标签
// 计费按 ElevenLabs 返回的 character-cost 统计，跑完报告本次用了多少字符、套餐还剩多少
// 单句失败保留原来合成的版本，不阻塞出刊；没有密钥或 ElevenLabs 连不上时退出码 3，原来的整期照样可用
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { pageOrder } from "./contracts.mjs";
import { inputFingerprint, recordBuild, atomicWrite } from "./build-state.mjs";

// 讲读稿的 emotion → Eleven v3 音频标签，写在句首；平静不加
const TAGS = {
  平静: "", 开心: "[happy]", 兴奋: "[excited]", 惊讶: "[surprised]", 神秘: "[mysteriously]",
  紧张: "[nervous]", 困倦: "[yawns]", 得意: "[proudly]", 委屈: "[sad]", 温柔: "[softly]",
};

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const target = args.find(a => !a.startsWith("--"));
if (!target) { console.error("用法: node tts_elevenlabs.mjs <issue 目录> [--dry]"); process.exit(1); }

const issue = resolve(target), dataDir = resolve(issue, "..", "..");
const confFile = join(dataDir, "voices", "elevenlabs.json");
if (!existsSync(confFile)) { console.log("没有 voices/elevenlabs.json，不用 ElevenLabs"); process.exit(0); }
const conf = JSON.parse(readFileSync(confFile, "utf8"));
const MODEL = conf.model || "eleven_v3", tags = { ...TAGS, ...conf.tags };
const BASE = "https://api.elevenlabs.io/v1", KEY = process.env.ELEVENLABS_API_KEY;

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
const sha = s => createHash("sha256").update(s).digest("hex");
const voiceOf = (line, card) => (card === serialCard && conf[`${line.who}/${line.lang}@serial`]) || conf[`${line.who}/${line.lang}`];
const label = v => `ElevenLabs-${v.name ?? v.voice_id}`;
const tagged = line => { const t = line.emotion ? tags[line.emotion] ?? `[${line.emotion}]` : ""; return (t ? t + " " : "") + plain(line.text); };

const byFile = Object.fromEntries(man.files.map(f => [f.file, f]));
const todo = [], used = new Set();
let kept = 0;
for (const page of nar) page.lines.forEach((line, i) => {
  const v = voiceOf(line, page.card);
  if (!v) return;
  if (!v.voice_id) throw new Error(`elevenlabs.json 的 ${line.who}/${line.lang} 没写 voice_id`);
  used.add(`${line.who}/${line.lang}${page.card === serialCard && conf[`${line.who}/${line.lang}@serial`] ? "@serial" : ""}`);
  const file = `c${page.card}_${String(i).padStart(2, "0")}.wav`, entry = byFile[file], text = tagged(line);
  if (!entry) throw new Error(`manifest 里没有 ${file}，先重跑整期合成`);
  const key = sha(JSON.stringify([MODEL, v.voice_id, line.lang, text, v.stability ?? 0.5, v.pitch ?? 0, v.speed ?? 1])).slice(0, 12);
  const path = join(outDir, file);
  if (entry.by === label(v) && entry.el_hash === key && existsSync(path)) { kept++; entry.audio_hash = sha(readFileSync(path)); }
  else todo.push({ file, path, entry, text, lang: line.lang, v, key });
});
const estimate = todo.reduce((n, t) => n + [...t.text].length, 0);
console.log(`ElevenLabs ${todo.length + kept} 句：已替换可跳过 ${kept} 句，要合成 ${todo.length} 句（约 ${estimate} 字符）`);
if (dry) { for (const t of todo.slice(0, 5)) console.log(`  ${t.file} ${t.v.name}：${t.text}`); process.exit(0); }
if (!todo.length) { finish(); process.exit(0); }
if (!KEY) { console.error("没有 ElevenLabs 密钥：设置环境变量 ELEVENLABS_API_KEY。原来合成的音频照样可用"); process.exit(3); }

async function quota() {
  const res = await fetch(`${BASE}/user/subscription`, { headers: { "xi-api-key": KEY } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const s = await res.json();
  return s.character_limit - s.character_count;
}
let left;
try { left = await quota(); } catch (e) { console.error(`ElevenLabs 连不上：${e.message}。原来合成的音频照样可用`); process.exit(3); }
if (left < estimate) { console.error(`套餐只剩 ${left} 字符，这期要约 ${estimate}，先不合成`); process.exit(3); }

const sleep = ms => new Promise(ok => setTimeout(ok, ms));
// 返回 24kHz 16 位单声道 PCM 和这句的计费字符
async function synth(t) {
  const body = { text: t.text, model_id: MODEL, language_code: t.lang, voice_settings: { stability: t.v.stability ?? 0.5 } };
  let last;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${BASE}/text-to-speech/${t.v.voice_id}?output_format=pcm_24000`, {
      method: "POST", headers: { "xi-api-key": KEY, "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(e => ({ ok: false, status: 0, text: async () => e.message }));
    if (res.ok) return { pcm: Buffer.from(await res.arrayBuffer()), cost: +(res.headers.get("character-cost") ?? [...t.text].length) };
    last = `HTTP ${res.status} ${(await res.text()).slice(0, 200)}`;
    if (res.status && res.status < 500 && res.status !== 429) break;  // 参数错、密钥错、额度用完，重试也没用
    await sleep(2000 * 2 ** attempt);
  }
  throw new Error(last);
}
// 包成 wav，统一成和 Azure、MiMo 一样的 24kHz 16 位单声道；pitch 改采样率抬高音高，再用 atempo 把语速拉回原样，speed 也在 atempo 里乘上
function toWav(pcm, { pitch: semitones = 0, speed = 1 }) {
  const r = 2 ** (semitones / 12), dir = mkdtempSync(join(tmpdir(), "el-"));
  try {
    writeFileSync(join(dir, "a.pcm"), pcm);
    const af = semitones || speed !== 1 ? ["-af", `${semitones ? `asetrate=${24000 * r},aresample=24000,` : ""}atempo=${speed / r}`] : [];
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", join(dir, "a.pcm"), ...af, "-ar", "24000", "-ac", "1", "-sample_fmt", "s16", "-bitexact", join(dir, "b.wav")]);
    return readFileSync(join(dir, "b.wav"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
function seconds(wav) {
  const i = wav.indexOf("data", 12, "ascii");
  return (i > 0 ? wav.readUInt32LE(i + 4) : wav.length - 44) / (24000 * 2);
}

// Starter 套餐最多 3 路并发，留一路给别的请求
let n = 0, failed = 0, cost = 0;
const queue = [...todo];
await Promise.all(Array.from({ length: 2 }, async () => {
  for (let t; (t = queue.shift());) {
    try {
      const res = await synth(t), wav = toWav(res.pcm, t.v);
      cost += res.cost;
      atomicWrite(t.path, wav);
      Object.assign(t.entry, { seconds: +seconds(wav).toFixed(2), audio_hash: sha(wav), by: label(t.v), el_hash: t.key });
      save(false);
      process.stdout.write(`\r已替换 ${++n}/${todo.length} 句，用了 ${cost} 字符`);
    } catch (e) { failed++; console.warn(`\n${t.file} 失败，保留原版：${e.message}`); }
  }
}));
finish();
const rest = await quota().catch(() => null);
console.log(`\n完成：替换 ${todo.length - failed} 句，跳过 ${kept} 句，本次用了 ${cost} 字符${rest == null ? "" : `，套餐还剩 ${rest} 字符`}${failed ? `；${failed} 句失败保留原版（重跑可补）` : ""}`);

function save(complete) {
  const by = (man._meta.by ?? "Azure 语音").replace(/ \+ ElevenLabs/, "");
  atomicWrite(manPath, JSON.stringify({ ...man, _meta: { ...man._meta, by: by.replace(/( \+ VoiceStudio)?$/, " + ElevenLabs$1"), at: new Date().toISOString(), complete } }, null, 2));
}
function finish() {
  for (const key of used) {
    const v = conf[key];
    man.voices[key.replace("@serial", "（连载）")] = `ElevenLabs ${v.name ?? v.voice_id}（${MODEL}）${v.pitch ? ` ${v.pitch > 0 ? "+" : ""}${v.pitch} 半音` : ""}${v.speed && v.speed !== 1 ? ` 语速 ×${v.speed}` : ""}`;
  }
  save(true);
  recordBuild(issue, "60-audio", inputs, [manPath, ...man.files.map(f => join(outDir, f.file))]);
}
