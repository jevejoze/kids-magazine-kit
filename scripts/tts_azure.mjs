#!/usr/bin/env node
// 第 60 步：用 Azure 语音把 50-narration.json 每一句合成成 wav。需要 Node 22+，不用装依赖。
//   node scripts/tts_azure.mjs <issue 目录>            合成整期（已经合成过、内容没变的句子跳过）
//   node scripts/tts_azure.mjs <issue 目录> --dry      只算计费字符，不调用 Azure
//   node scripts/tts_azure.mjs --audition <数据目录>   每个角色每种语言合成一句试听，写到 <数据目录>/voices/试听/
// 环境变量：AZURE_SPEECH_KEY、AZURE_SPEECH_REGION（免费 F0 资源）
//           AZURE_SPEECH_KEY_PAID、AZURE_SPEECH_REGION_PAID（可选，付费 S0 资源，免费额度用完或被限流时接着用）
// 声音：数据目录 voices/azure.json 写每个角色每种语言用哪个声音，没写的用下面的 DEFAULT_VOICES。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const DEFAULT_VOICES = {
  "narrator/zh": "zh-CN-XiaoxiaoNeural", "narrator/en": "en-GB-SoniaNeural",
  "dog/zh": "zh-CN-YunxiaNeural",
  "mouse/zh": "en-GB-AdaMultilingualNeural", "mouse/en": "en-GB-MaisieNeural",
  "owl/zh": "zh-CN-YunyeNeural", "owl/en": "en-GB-RyanNeural",
  "raccoon/zh": "zh-CN-YunxiNeural", "raccoon/en": "en-GB-ElliotNeural",
};
// 讲读稿的 emotion → Azure 说话风格。声音不支持的风格 Azure 会按普通语气念；平静、困倦、得意不加标签，省计费字符
const STYLE = { 开心: "cheerful", 兴奋: "excited", 惊讶: "cheerful", 委屈: "sad", 紧张: "fearful", 温柔: "gentle", 神秘: "whispering" };
const LOCALE = { zh: "zh-CN", en: "en-GB" };
const SAMPLE = { zh: "妮妮早上好，今天我们一起来猜一个问题！", en: "Good morning! Shall we guess today's question together?" };

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const audition = args.includes("--audition");
const target = args.find(a => !a.startsWith("--"));
if (!target) { console.error("用法: node tts_azure.mjs <issue 目录> [--dry] | --audition <数据目录>"); process.exit(1); }

const dataDir = audition ? resolve(target) : resolve(target, "..", "..");
const voiceFile = join(dataDir, "voices", "azure.json");
const voices = { ...DEFAULT_VOICES, ...(existsSync(voiceFile) ? JSON.parse(readFileSync(voiceFile, "utf8")) : {}) };
delete voices._comment;

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plain = s => s.replace(/<[^>]+>/g, "");
// SSML：<speak> 和 <voice> 标签不计费，其余标签和正文都计费，汉字按 2 个字符算
function ssml(line) {
  const voice = voices[`${line.who}/${line.lang}`] || voices[`narrator/${line.lang}`];
  const style = STYLE[line.emotion];
  const body = style ? `<mstts:express-as style="${style}">${esc(plain(line.text))}</mstts:express-as>` : esc(plain(line.text));
  return {
    voice, body,
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
if (!dry && !keys.length) { console.error("没有 Azure 密钥：设置环境变量 AZURE_SPEECH_KEY 和 AZURE_SPEECH_REGION（如 eastasia）"); process.exit(1); }

if (audition) {
  const out = join(dataDir, "voices", "试听");
  mkdirSync(out, { recursive: true });
  let total = 0;
  for (const role of Object.keys(voices)) {
    const [who, lang] = role.split("/");
    const { xml, body } = ssml({ who, lang, text: SAMPLE[lang], emotion: "开心" });
    total += billable(body);
    if (dry) continue;
    const { wav } = await synth(xml);
    writeFileSync(join(out, `${who}-${lang}.wav`), wav);
    console.log(`${role}  ${voices[role]}`);
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
let spent = 0, planned = 0, skipped = 0, paid = 0;
for (const page of nar) {
  for (const [i, line] of page.lines.entries()) {
    const file = `c${page.card}_${String(i).padStart(2, "0")}.wav`;
    const { voice, body, xml } = ssml(line);
    used[`${line.who}/${line.lang}`] = voice;
    const hash = createHash("sha1").update(xml).digest("hex").slice(0, 12);
    const cost = billable(body);
    planned += cost;
    const prev = oldByFile[file];
    if (prev?.hash === hash && existsSync(join(outDir, file))) {
      files.push(prev); skipped++; continue;
    }
    if (dry) continue;
    const { wav, by } = await synth(xml);
    writeFileSync(join(outDir, file), wav);
    spent += cost; if (by === "付费") paid++;
    files.push({ card: page.card, index: i, file, seconds: +seconds(wav).toFixed(2), hash, by });
    process.stdout.write(`\r已合成 ${files.length} 句`);
  }
}
if (dry) { console.log(`整期 ${planned} 计费字符；已合成可跳过 ${skipped} 句`); process.exit(0); }
writeFileSync(manPath, JSON.stringify({
  _meta: { stage: "60-audio", by: "Azure 语音", at: new Date().toISOString() },
  voices: used, billable_chars: { this_run: spent, whole_issue: planned }, paid_lines: paid, files,
}, null, 2));
console.log(`\n${files.length} 句完成：本次合成 ${files.length - skipped} 句（${spent} 计费字符${paid ? `，其中 ${paid} 句走付费资源` : ""}），跳过 ${skipped} 句`);
