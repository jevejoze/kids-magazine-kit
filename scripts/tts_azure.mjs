#!/usr/bin/env node
// 第 60 步：用 Azure 语音把 50-narration.json 每一句合成成 wav。需要 Node 22+，不用装依赖。
//   node scripts/tts_azure.mjs <issue 目录>            合成整期（已经合成过、内容没变的句子跳过）
//   node scripts/tts_azure.mjs <issue 目录> --dry      只算计费字符，不调用 Azure
//   node scripts/tts_azure.mjs --audition <数据目录>   每个角色每种语言合成一句试听，写到 <数据目录>/voices/试听/
//   node scripts/tts_azure.mjs <issue 目录> --pinyin    列出讲读稿里还没注音的多音字，合成前逐条确认
// 环境变量：AZURE_SPEECH_KEY、AZURE_SPEECH_REGION（免费 F0 资源）
//           AZURE_SPEECH_KEY_PAID、AZURE_SPEECH_REGION_PAID（可选，付费 S0 资源，免费额度用完或被限流时接着用）
// 声音：数据目录 voices/azure.json 写每个角色每种语言用哪个声音，没写的用下面的 DEFAULT_VOICES。
//       值可以是声音名，也可以是 {"voice": "声音名", "pitch": 3}：pitch 是合成后用 ffmpeg 升（负数为降）几个半音，
//       语速不变、不占计费字符，用来让声音更卡通
// 多音字：scripts/polyphones.json 是通用词典，数据目录 voices/polyphones.json 补充或覆盖，讲读稿单句的 pron 字段优先级最高；
//       写法都是 {"在行": "zai4 hang2"}，合成时自动包成 <phoneme alphabet="sapi" ph="zai 4 hang 2">在行</phoneme>
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const DEFAULT_VOICES = {
  "narrator/zh": "zh-CN-XiaoxiaoNeural", "narrator/en": "en-GB-SoniaNeural",
  "dog/zh": "zh-CN-YunxiaNeural",
  "mouse/zh": "en-GB-AdaMultilingualNeural", "mouse/en": "en-GB-MaisieNeural",
  "owl/zh": { voice: "zh-CN-YunfengNeural", pitch: 3 }, "owl/en": "en-GB-RyanNeural",
  "raccoon/zh": "zh-CN-YunxiNeural", "raccoon/en": "en-GB-ElliotNeural",
};
// 讲读稿的 emotion → Azure 说话风格。声音不支持的风格 Azure 会按普通语气念；平静、困倦、得意不加标签，省计费字符
const STYLE = { 开心: "cheerful", 兴奋: "excited", 惊讶: "cheerful", 委屈: "sad", 紧张: "fearful", 温柔: "gentle", 神秘: "whispering" };
const LOCALE = { zh: "zh-CN", en: "en-GB" };
const SAMPLE = { zh: "早上好，今天我们一起来猜一个问题！", en: "Good morning! Shall we guess today's question together?" };

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const pinyinCheck = args.includes("--pinyin");
const audition = args.includes("--audition");
const target = args.find(a => !a.startsWith("--"));
if (!target) { console.error("用法: node tts_azure.mjs <issue 目录> [--dry] | --audition <数据目录>"); process.exit(1); }

const dataDir = audition ? resolve(target) : resolve(target, "..", "..");
const voiceFile = join(dataDir, "voices", "azure.json");
const voices = { ...DEFAULT_VOICES, ...(existsSync(voiceFile) ? JSON.parse(readFileSync(voiceFile, "utf8")) : {}) };
delete voices._comment;

const here = new URL(".", import.meta.url).pathname;
const OK = new Set();
const loadDict = f => {
  if (!existsSync(f)) return {};
  const d = JSON.parse(readFileSync(f, "utf8"));
  (d._ok || []).forEach(w => OK.add(w)); // _ok：默认就读对的词，不注音，只让 --pinyin 不再提醒
  delete d._comment; delete d._ok;
  return d;
};
const PRON = { ...loadDict(join(decodeURIComponent(here), "polyphones.json")), ...loadDict(join(dataDir, "voices", "polyphones.json")) };
// 容易读错的多音字：句子里有它、又没被词典里的词盖住，--pinyin 会把这句列出来
const RISKY = "行长重还乐数便差传调处藏种量角朝曾系露载模倒降钻弹卷晕参称尽薄奇";
const sapi = py => py.trim().split(/\s+/).map(x => x.replace(/^([a-zv]+)([1-5])$/i, "$1 $2")).join(" ");
function pronOf(line) {
  const dict = { ...PRON, ...(line.pron || {}) };
  const words = Object.keys(dict).sort((a, b) => b.length - a.length);
  return { dict, re: words.length ? new RegExp(words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g") : null };
}
// 给中文句子里的多音字词加注音；正文先转义，词典里的词都是汉字，转义不影响匹配
function annotate(text, line) {
  if (line.lang !== "zh") return esc(text);
  const { dict, re } = pronOf(line);
  return re ? esc(text).replace(re, w => `<phoneme alphabet="sapi" ph="${sapi(dict[w])}">${w}</phoneme>`) : esc(text);
}
function uncovered(line) {
  if (line.lang !== "zh") return [];
  const text = plain(line.text), { re } = pronOf(line), covered = new Set();
  const mark = r => { for (const m of text.matchAll(r)) for (let i = m.index; i < m.index + m[0].length; i++) covered.add(i); };
  if (re) mark(re);
  if (OK.size) mark(new RegExp([...OK].join("|"), "g"));
  return [...text].flatMap((c, i) => RISKY.includes(c) && !covered.has(i) ? [`${text.slice(Math.max(0, i - 2), i)}【${c}】${text.slice(i + 1, i + 3)}`] : []);
}

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plain = s => s.replace(/<[^>]+>/g, "");
// SSML：<speak> 和 <voice> 标签不计费，其余标签和正文都计费，汉字按 2 个字符算
const voiceOf = role => { const v = voices[role]; return typeof v === "string" ? { voice: v, pitch: 0 } : v ? { pitch: 0, ...v } : null; };
function ssml(line) {
  const { voice, pitch } = voiceOf(`${line.who}/${line.lang}`) || voiceOf(`narrator/${line.lang}`);
  const style = STYLE[line.emotion];
  const said = annotate(plain(line.text), line);
  const body = style ? `<mstts:express-as style="${style}">${said}</mstts:express-as>` : said;
  return {
    voice, pitch, body,
    xml: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${LOCALE[line.lang]}"><voice name="${voice}">${body}</voice></speak>`,
  };
}
const billable = s => [...s].reduce((n, c) => n + (/[㐀-鿿豈-﫿]/.test(c) ? 2 : 1), 0);

const keys = [
  { key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION, name: "免费", gap: 3200 }, // F0 每分钟最多 20 次请求
  { key: process.env.AZURE_SPEECH_KEY_PAID, region: process.env.AZURE_SPEECH_REGION_PAID, name: "付费", gap: 300 },
].filter(k => k.key && k.region);
let current = 0;
const sleep = ms => new Promise(ok => setTimeout(ok, ms));

async function synth(xml) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const k = keys[current];
    if (!k) throw new Error("没有可用的 Azure 密钥：设置 AZURE_SPEECH_KEY 和 AZURE_SPEECH_REGION");
    const res = await fetch(`https://${k.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": k.key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm", "User-Agent": "kids-magazine-kit" },
      body: xml,
    });
    if (res.ok) { await sleep(k.gap); return { wav: Buffer.from(await res.arrayBuffer()), by: k.name }; }
    const msg = (await res.text()).slice(0, 200);
    // 额度用完（403）或连续被限流（429）：有付费资源就换过去
    if ((res.status === 403 || (res.status === 429 && attempt >= 2)) && current + 1 < keys.length) {
      console.warn(`  ${k.name}资源 ${res.status}，改用${keys[current + 1].name}资源`); current++; continue;
    }
    if (res.status === 429) { await sleep(1000 * (Number(res.headers.get("retry-after")) || 15)); continue; }
    throw new Error(`Azure ${res.status}：${msg}`);
  }
  throw new Error("重试多次仍失败");
}

const seconds = wav => (wav.length - 44) / (24000 * 2);
// 升降调：改采样率抬高音高，再用 atempo 把语速拉回原样
function shift(wav, semitones) {
  if (!semitones) return wav;
  const r = 2 ** (semitones / 12), dir = mkdtempSync(join(tmpdir(), "pitch-"));
  try {
    writeFileSync(join(dir, "a.wav"), wav);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", join(dir, "a.wav"), "-af", `asetrate=${24000 * r},aresample=24000,atempo=${1 / r}`, join(dir, "b.wav")]);
    return readFileSync(join(dir, "b.wav"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
if (pinyinCheck) {
  const nar = JSON.parse(readFileSync(join(resolve(target), "50-narration.json"), "utf8")).narration;
  let n = 0;
  for (const page of nar) page.lines.forEach((line, i) => {
    const hits = uncovered(line);
    if (!hits.length) return;
    n++;
    console.log(`c${page.card}_${String(i).padStart(2, "0")}  ${plain(line.text)}\n        待确认：${hits.map(h => `「${h}」`).join(" ")}`);
  });
  console.log(n ? `\n${n} 句有没注音的多音字。读音可能错的，在这一句加 "pron": {"词": "拼音"}，常用的词加进数据目录 voices/polyphones.json` : "没有待确认的多音字");
  process.exit(0);
}
if (!dry && !keys.length) { console.error("没有 Azure 密钥：设置环境变量 AZURE_SPEECH_KEY 和 AZURE_SPEECH_REGION（如 eastasia）"); process.exit(1); }

if (audition) {
  const out = join(dataDir, "voices", "试听");
  mkdirSync(out, { recursive: true });
  let total = 0;
  for (const role of Object.keys(voices)) {
    const [who, lang] = role.split("/");
    const { xml, body, voice, pitch } = ssml({ who, lang, text: SAMPLE[lang], emotion: "开心" });
    total += billable(body);
    if (dry) continue;
    const { wav } = await synth(xml);
    writeFileSync(join(out, `${who}-${lang}.wav`), shift(wav, pitch));
    console.log(`${role}  ${voice}${pitch ? `（${pitch > 0 ? "升" : "降"} ${Math.abs(pitch)} 个半音）` : ""}`);
  }
  console.log(`试听共 ${total} 计费字符${dry ? "（未调用）" : `，文件在 ${out}`}`);
  process.exit(0);
}

const issue = resolve(target);
const nar = JSON.parse(readFileSync(join(issue, "50-narration.json"), "utf8")).narration;
const outDir = join(issue, "60-audio");
mkdirSync(outDir, { recursive: true });
const manPath = join(outDir, "manifest.json");
const old = existsSync(manPath) ? JSON.parse(readFileSync(manPath, "utf8")) : { files: [] };
const oldByFile = Object.fromEntries((old.files ?? []).map(f => [f.file, f]));

const files = [], used = {};
let spent = 0, planned = 0, skipped = 0, paid = 0, phonemes = 0, sample = "";
for (const page of nar) {
  for (const [i, line] of page.lines.entries()) {
    const file = `c${page.card}_${String(i).padStart(2, "0")}.wav`;
    const { voice, pitch, body, xml } = ssml(line);
    used[`${line.who}/${line.lang}`] = pitch ? `${voice} ${pitch > 0 ? "+" : ""}${pitch} 半音` : voice;
    const hash = createHash("sha1").update(xml + pitch).digest("hex").slice(0, 12);
    const cost = billable(body);
    planned += cost;
    const ph = (body.match(/<phoneme /g) || []).length;
    phonemes += ph; if (ph && !sample) sample = body;
    const prev = oldByFile[file];
    if (prev?.hash === hash && existsSync(join(outDir, file))) {
      files.push(prev); skipped++; continue;
    }
    if (dry) continue;
    const { wav: raw, by } = await synth(xml);
    const wav = shift(raw, pitch);
    writeFileSync(join(outDir, file), wav);
    spent += cost; if (by === "付费") paid++;
    files.push({ card: page.card, index: i, file, seconds: +seconds(wav).toFixed(2), hash, by });
    process.stdout.write(`\r已合成 ${files.length} 句`);
  }
}
if (dry) { console.log(`整期 ${planned} 计费字符（含多音字注音 ${phonemes} 处）；已合成可跳过 ${skipped} 句${sample ? `\n注音示例：${sample}` : ""}`); process.exit(0); }
writeFileSync(manPath, JSON.stringify({
  _meta: { stage: "60-audio", by: "Azure 语音", at: new Date().toISOString() },
  voices: used, billable_chars: { this_run: spent, whole_issue: planned }, paid_lines: paid, files,
}, null, 2));
console.log(`\n${files.length} 句完成：本次合成 ${files.length - skipped} 句（${spent} 计费字符${paid ? `，其中 ${paid} 句走付费资源` : ""}），跳过 ${skipped} 句`);
