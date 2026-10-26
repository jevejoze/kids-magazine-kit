#!/usr/bin/env node
// 第 60 步的另一种做法：用小米 MiMo 语音把 50-narration.json 每一句合成成 wav。需要 Node 22+，不用装依赖。
//   node scripts/tts_mimo.mjs <issue 目录>            合成整期（已经合成过、内容和声音没变的句子跳过，可随时中断重跑）
//   node scripts/tts_mimo.mjs <issue 目录> --dry      只列出要合成几句，不调用 MiMo
//   node scripts/tts_mimo.mjs --audition <数据目录>   每个角色合成一句试听，写到 <数据目录>/voices/试听/mimo-*.wav
// 环境变量：MIMO_API_KEY（可选 MIMO_BASE_URL，默认 https://api.xiaomimimo.com/v1）
// 声音：数据目录 voices/mimo.json，键是 角色/语言，加 @serial 表示只用于经典连载（读书）那一页：
//   {"narrator/zh": {"clone": "clone/parent/ref.wav"}, "narrator/zh@serial": {"clone": "clone/parent-reading/ref.wav"},
//    "dog/zh": {"voice": "苏打", "style": "憨憨的小男孩，慢悠悠的"}, "owl/zh": {"voice": "白桦", "pitch": 2}}
//   voice 是 MiMo 内置音色（冰糖 茉莉 苏打 白桦 Mia Chloe Milo Dean）；clone 是相对 voices/ 的参照音频（wav 或 mp3，几秒到一分钟），
//   用 mimo-v2.5-tts-voiceclone 克隆；style 是给这个角色的语气说明；pitch 是合成后用 ffmpeg 升降几个半音（需要 ffmpeg）。
//   没写的角色用下面的 DEFAULT_VOICES，没写的语言退回旁白
// 讲读稿的 emotion 写成句首的风格标签，如"(开心)今天……"。MiMo 不支持注音，多音字读错时改讲读稿的说法
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";
import { createHash } from "node:crypto";
import { createPipeline } from "./pipeline-lib.mjs";
import { pageOrder } from "./contracts.mjs";
import { inputFingerprint, recordBuild, atomicWrite } from "./build-state.mjs";

const DEFAULT_VOICES = {
  "narrator/zh": { voice: "冰糖", style: "温暖的女声，像讲睡前故事" }, "narrator/en": { voice: "Mia", style: "warm British storyteller" },
  "dog/zh": { voice: "苏打", style: "憨憨的小男孩，慢悠悠的，有点迷糊，爱打哈欠" },
  "mouse/zh": { voice: "茉莉", style: "伦敦来的小女孩，中文说得有点蹩脚，带英国口音" }, "mouse/en": { voice: "Chloe", style: "a cheerful little British girl" },
  "owl/zh": { voice: "白桦", style: "沉稳博学的老先生，讲到关键处放慢" }, "owl/en": { voice: "Dean", style: "a calm, wise British professor" },
  "raccoon/zh": { voice: "冰糖", style: "调皮捣蛋的小家伙，语气夸张，爱\"哼\"一声，嘴硬心软" }, "raccoon/en": { voice: "Milo", style: "a cheeky, mischievous British kid" },
};
const SAMPLE = { zh: "早上好，今天我们一起来猜一个问题！", en: "Good morning! Shall we guess today's question together?" };
const MIME = { ".wav": "audio/wav", ".mp3": "audio/mpeg" };

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const audition = args.includes("--audition");
const target = args.find(a => !a.startsWith("--"));
if (!target) { console.error("用法: node tts_mimo.mjs <issue 目录> [--dry] | --audition <数据目录>"); process.exit(1); }

const dataDir = audition ? resolve(target) : resolve(target, "..", "..");
const confFile = join(dataDir, "voices", "mimo.json");
const conf = existsSync(confFile) ? JSON.parse(readFileSync(confFile, "utf8")) : {};
delete conf._comment;
const voices = { ...DEFAULT_VOICES, ...conf };
const BASE = (process.env.MIMO_BASE_URL || "https://api.xiaomimimo.com/v1").replace(/\/$/, "");
const KEY = process.env.MIMO_API_KEY;
if (!dry && !KEY) { console.error("没有 MiMo 密钥：设置环境变量 MIMO_API_KEY"); process.exit(1); }

const plain = s => s.replace(/<[^>]+>/g, "");
const sha = b => createHash("sha256").update(b).digest("hex");
const refs = {};  // 参照音频路径 → { uri, sha }
function ref(path) {
  if (refs[path]) return refs[path];
  const file = join(dataDir, "voices", path), mime = MIME[extname(file).toLowerCase()];
  if (!mime) throw new Error(`参照音频只能是 wav 或 mp3：${path}`);
  if (!existsSync(file)) throw new Error(`找不到参照音频 voices/${path}`);
  const buf = readFileSync(file), uri = `data:${mime};base64,${buf.toString("base64")}`;
  if (uri.length > 10e6) throw new Error(`参照音频太大（base64 超过 10MB）：${path}，截短一点`);
  return refs[path] = { uri, sha: sha(buf).slice(0, 12) };
}
const voiceOf = (who, lang, serial) => {
  const v = (serial && voices[`${who}/${lang}@serial`]) || voices[`${who}/${lang}`] || (serial && voices[`narrator/${lang}@serial`]) || voices[`narrator/${lang}`];
  return typeof v === "string" ? { voice: v } : v;
};
const label = v => v.clone ? `克隆 ${v.clone}` : v.voice;
// 一句话的请求：风格说明放 user，正文放 assistant，emotion 写成句首标签
function request(line, serial) {
  const v = voiceOf(line.who, line.lang, serial);
  const text = (line.emotion ? `(${line.emotion})` : "") + plain(line.text);
  const body = {
    model: v.clone ? "mimo-v2.5-tts-voiceclone" : "mimo-v2.5-tts",
    messages: [{ role: "user", content: v.style ?? "" }, { role: "assistant", content: text }],
    audio: { format: "wav", voice: v.clone ? ref(v.clone).uri : v.voice },
  };
  const key = JSON.stringify([body.model, v.clone ? ref(v.clone).sha : v.voice, v.style ?? "", text, v.pitch ?? 0]);
  return { v, body, hash: sha(key).slice(0, 12) };
}

const sleep = ms => new Promise(ok => setTimeout(ok, ms));
async function synth(body) {
  let last;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` }, body: JSON.stringify(body),
    }).catch(e => ({ ok: false, status: 0, text: async () => e.message }));
    if (res.ok) {
      const data = (await res.json()).choices?.[0]?.message?.audio?.data;
      if (data) return Buffer.from(data, "base64");
      last = "返回里没有音频";
    } else last = `HTTP ${res.status} ${(await res.text()).slice(0, 200)}`;
    if (res.status && res.status < 500 && res.status !== 429) break;  // 参数错、密钥错，重试也没用
    await sleep(2000 * 2 ** attempt);
  }
  throw new Error(`MiMo ${last}`);
}
// 统一成 24kHz 16 位单声道；pitch 改采样率抬高音高，再用 atempo 把语速拉回原样
function normalize(wav, semitones = 0) {
  const r = 2 ** (semitones / 12), dir = mkdtempSync(join(tmpdir(), "mimo-"));
  try {
    writeFileSync(join(dir, "a.wav"), wav);
    const af = semitones ? ["-af", `asetrate=${24000 * r},aresample=24000,atempo=${1 / r}`] : [];
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", join(dir, "a.wav"), ...af, "-ar", "24000", "-ac", "1", "-sample_fmt", "s16", "-bitexact", join(dir, "b.wav")]);
    return readFileSync(join(dir, "b.wav"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
function seconds(wav) {
  const i = wav.indexOf("data", 12, "ascii");
  return (i > 0 ? wav.readUInt32LE(i + 4) : wav.length - 44) / (24000 * 2);
}

if (audition) {
  const out = join(dataDir, "voices", "试听");
  mkdirSync(out, { recursive: true });
  for (const role of Object.keys(voices)) {
    const [who, rest] = role.split("/"), [lang, tag] = rest.split("@");
    const { v, body } = request({ who, lang, text: SAMPLE[lang], emotion: "开心" }, tag === "serial");
    if (dry) { console.log(`${role}  ${label(v)}`); continue; }
    writeFileSync(join(out, `mimo-${who}-${lang}${tag ? "-" + tag : ""}.wav`), normalize(await synth(body), v.pitch));
    console.log(`${role}  ${label(v)}${v.style ? `（${v.style}）` : ""}`);
  }
  if (!dry) console.log(`试听文件在 ${out}`);
  process.exit(0);
}

const issue = resolve(target);
if (!dry && !createPipeline(issue).done("50-narration")) throw new Error("讲读稿未通过检查或内容已过期，请先重新审稿并更新讲读稿");
const inputs = inputFingerprint(issue, "60-audio");
const nar = JSON.parse(readFileSync(join(issue, "50-narration.json"), "utf8")).narration;
const data = JSON.parse(readFileSync(join(issue, "30-issue.json"), "utf8"));
// 连载页按渲染顺序定位；周五的音乐盒、放映室、动手做不算
const serialCard = data.serial && (data.serial.kind ?? "book") === "book" ? pageOrder(data).indexOf("serial") + 1 : 0;
const outDir = join(issue, "60-audio"), manPath = join(outDir, "manifest.json");
if (!dry) mkdirSync(outDir, { recursive: true });
const old = existsSync(manPath) ? JSON.parse(readFileSync(manPath, "utf8")) : { files: [] };
const oldByFile = Object.fromEntries((old.files ?? []).map(f => [f.file, f]));

const used = {}, jobs = [], files = [];
let skipped = 0;
for (const page of nar) page.lines.forEach((line, i) => {
  const file = `c${page.card}_${String(i).padStart(2, "0")}.wav`, serial = page.card === serialCard;
  const { v, body, hash } = request(line, serial);
  used[`${line.who}/${line.lang}${serial && voices[`${line.who}/${line.lang}@serial`] ? "（连载）" : ""}`] = `MiMo ${label(v)}${v.pitch ? ` ${v.pitch > 0 ? "+" : ""}${v.pitch} 半音` : ""}`;
  const prev = oldByFile[file], path = join(outDir, file);
  const cached = prev?.by === "MiMo" && prev.hash === hash && existsSync(path) ? readFileSync(path) : null;
  if (cached?.length > 44 && prev.audio_hash === sha(cached)) { files.push(prev); skipped++; return; }
  const entry = { card: page.card, index: i, file };
  files.push(entry); jobs.push({ entry, body, hash, pitch: v.pitch, path });
});
console.log(`整期 ${files.length} 句：已合成可跳过 ${skipped} 句，要合成 ${jobs.length} 句`);
if (dry) { for (const [role, v] of Object.entries(used)) console.log(`  ${role}  ${v}`); process.exit(0); }

const save = complete => atomicWrite(manPath, JSON.stringify({
  _meta: { stage: "60-audio", by: "MiMo 语音", at: new Date().toISOString(), complete },
  voices: used, files: complete ? files : files.filter(f => f.audio_hash),
}, null, 2));
// MiMo 每分钟 100 次请求，4 路并发足够快又不会被限流
let n = 0, failed = 0;
const queue = [...jobs];
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let job; (job = queue.shift());) {
    try {
      const wav = normalize(await synth(job.body), job.pitch);
      atomicWrite(job.path, wav);
      Object.assign(job.entry, { seconds: +seconds(wav).toFixed(2), hash: job.hash, audio_hash: sha(wav), by: "MiMo" });
      save(false);
      process.stdout.write(`\r已合成 ${++n}/${jobs.length} 句`);
    } catch (e) { failed++; console.warn(`\n${job.entry.file} 失败：${e.message}`); }
  }
}));
if (failed) { save(false); console.error(`\n${failed} 句失败，重跑同一命令补上`); process.exit(1); }
save(true);
recordBuild(issue, "60-audio", inputs, [manPath, ...files.map(f => join(outDir, f.file))]);
console.log(`\n${files.length} 句完成：本次合成 ${jobs.length} 句，跳过 ${skipped} 句`);
