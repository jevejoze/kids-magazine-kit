#!/usr/bin/env node
// 用法: node render.mjs <issue.json> [输出目录] [--flat] [--preview [--allow-overflow]]
// 产出: 输出目录/issue-NNN/{issue.html, card-1..N.png, <刊名>-第NNN期.pdf}；加 --flat 直接写进输出目录
// JSON 里以 .jpg/.jpeg/.png/.webp/.svg 结尾、且相对 JSON 所在目录存在的路径，会内嵌进 HTML；comic.diagram 的 SVG 按原文内联。
// 截图走 Chrome DevTools 协议，按每张卡片的实际位置裁切，需要 Node 22+（内置 WebSocket）。
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { inputFingerprint, recordBuild, publishDirectory } from "./build-state.mjs";
import { createPipeline } from "./pipeline-lib.mjs";
import { validateIssue } from "./contracts.mjs";
import { loadSections, sectionOrder, sectionDomId, issueHtml } from "./sections.mjs";
import { magazineCast } from "./ticket.mjs";
import { loadCharacterPack } from "./character-pack.mjs";

const args = process.argv.slice(2);
const flat = args.includes("--flat");
const preview = args.includes("--preview");
// --allow-overflow：版面溢出只提示、照常截图，给回归比对渲染旧期用；只能和 --preview 一起用
const allowOverflow = preview && args.includes("--allow-overflow");
const [jsonPath, outRoot = "."] = args.filter(x => !["--flat", "--preview", "--allow-overflow"].includes(x));
if (!jsonPath) { console.error("用法: node render.mjs <issue.json> [输出目录] [--flat] [--preview [--allow-overflow]]"); process.exit(1); }

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, "..", "assets");
const jsonDir = dirname(resolve(jsonPath));
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
const embed = (v, path = "") => {
  if (typeof v === "string") {
    const ext = extname(v).toLowerCase(), f = resolve(jsonDir, v);
    if (!MIME[ext] || !existsSync(f)) return v;
    if (ext === ".svg" && path === "comic.diagram") return readFileSync(f, "utf8");
    return `data:${MIME[ext]};base64,${readFileSync(f).toString("base64")}`;
  }
  if (Array.isArray(v)) return v.map((x, i) => embed(x, `${path}[${i}]`));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "_answers" ? x : embed(x, path ? `${path}.${k}` : k)]));
  return v;
};
const raw = JSON.parse(readFileSync(jsonPath, "utf8"));
const characterPack = loadCharacterPack(raw.character_pack);
const errors = validateIssue(raw);
if (!preview) {
  const pipeline = createPipeline(jsonDir);
  if (!pipeline.reviewPassed()) errors.push("正式渲染需要 31-review.md 的结论为「通过」；草稿请加 --preview");
  errors.push(...pipeline.assemblyErrors());
}
if (errors.length) {
  console.error(errors.join("\n"));
  if (!preview) process.exit(2);
  console.error("（--preview：以上问题只提示，照常渲染草稿）");
}
const inputs = preview ? null : inputFingerprint(jsonDir, "40-render");
const data = embed(raw);
const N = String(data.issue).padStart(3, "0");
const targetDir = flat ? resolve(outRoot) : resolve(outRoot, `issue-${N}`);
if ([jsonDir, assets, resolve(here, "..")].includes(targetDir)) throw new Error("请使用独立的成品目录，不能覆盖数据或引擎目录");
mkdirSync(dirname(targetDir), { recursive: true });
const outDir = mkdtempSync(join(dirname(targetDir), ".kids-render-"));
let proc, ws, profile;
const timers = new Set();
const timed = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
try {

// 栏目注册表：引擎和数据仓库的 sections/；注册了的栏目走自己的 page.js，其余走模板里的旧代码
const registry = loadSections({ engine: resolve(here, ".."), data: resolve(jsonDir, "..", "..") });
if (registry.errors.length) throw new Error(`栏目注册表有错：\n${registry.errors.join("\n")}`);
const sections = registry.sections;
const order = sectionOrder(data, sections), expected = order.map(key => sectionDomId(key, sections, data));
const cast = magazineCast(resolve(jsonDir, "..", ".."));
const html = issueHtml({ data, sections, characterPack, cast, title: `${data.masthead.zh} 第${N}期` });
const htmlPath = join(outDir, "issue.html");
writeFileSync(htmlPath, html);

const chrome = process.env.CHROME || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
].find(existsSync);
if (!chrome) throw new Error("找不到 Chrome，请设置环境变量 CHROME");

profile = mkdtempSync(join(tmpdir(), "dumpling-"));
proc = spawn(chrome, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=0",
  `--user-data-dir=${profile}`, ...(process.getuid?.() === 0 ? ["--no-sandbox"] : []), "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((ok, fail) => {
  let buf = "";
  const timeout = timed(() => fail(new Error("启动 Chrome 超时")), 10000);
  proc.on("error", fail);
  proc.stderr.on("data", d => { const m = (buf += d).match(/DevTools listening on (ws:\S+)/); if (m) { clearTimeout(timeout); ok(m[1]); } });
  proc.on("exit", c => fail(new Error(`Chrome 退出 (${c})`)));
});

ws = new WebSocket(wsUrl);
await new Promise((ok, fail) => {
  const timeout = timed(() => fail(new Error("Chrome WebSocket 连接超时")), 10000);
  ws.addEventListener("open", () => { clearTimeout(timeout); ok(); }, { once: true });
  ws.addEventListener("error", () => fail(new Error("Chrome WebSocket 连接失败")), { once: true });
});
let seq = 0;
const waiting = new Map(), events = new Map();
let pageError = null;
ws.addEventListener("message", e => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { const [ok, fail, timeout] = waiting.get(m.id); clearTimeout(timeout); waiting.delete(m.id); m.error ? fail(new Error(m.error.message)) : ok(m.result); }
  else if (m.method === "Runtime.exceptionThrown") { const d = m.params?.exceptionDetails; pageError ??= d?.exception?.description || d?.text || "页面脚本出错"; }
  else if (m.method && events.has(m.method)) { events.get(m.method)(m.params); events.delete(m.method); }
});
const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
  const id = ++seq;
  const timeout = timed(() => { waiting.delete(id); fail(new Error(`Chrome 调用超时：${method}`)); }, 30000);
  waiting.set(id, [ok, fail, timeout]);
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});
const once = method => new Promise((ok, fail) => {
  const timeout = timed(() => { events.delete(method); fail(new Error(`等待 Chrome 事件超时：${method}`)); }, 30000);
  events.set(method, result => { clearTimeout(timeout); ok(result); });
});

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, s);
  await send("Runtime.enable", {}, s);
  await send("Emulation.setDeviceMetricsOverride", { width: 1080, height: 1440, deviceScaleFactor: 1, mobile: false }, s);
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: pathToFileURL(htmlPath).href }, s);
  await loaded;
  const ready = await send("Runtime.evaluate", { expression: "Promise.all([document.fonts.ready, window.READY]).then(() => 1)", awaitPromise: true }, s);
  if (ready.exceptionDetails) throw new Error(ready.exceptionDetails.exception?.description || ready.exceptionDetails.text);
  if (pageError) throw new Error(`模板脚本出错：${pageError}`);
  const { result } = await send("Runtime.evaluate", {
    // clip：页脚超出卡片底边；overlap：正文压到页脚
    expression: `JSON.stringify([...document.querySelectorAll('.card')].map(c => {
      const r = c.getBoundingClientRect(), foot = c.querySelector('.foot'), prev = foot?.previousElementSibling;
      const clip = foot ? Math.round(foot.getBoundingClientRect().bottom - (r.bottom - 8)) : 0;
      const overlap = foot && prev ? Math.round(prev.getBoundingClientRect().bottom - foot.getBoundingClientRect().top) : 0;
      const textSelector = c.id === "c2" ? ".bubble-text,.takeaway,.fact,.h1" : c.id === "c5" ? ".taunt-text,.puz h3,.puz .body,.clues li>span,.question,.answer-content" : null;
      const spill = Boolean(textSelector) && [...c.querySelectorAll(textSelector)].some(el => el.scrollWidth > el.clientWidth + 1);
      return { id: c.closest('.section')?.id ?? c.id, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, clip, overlap, spill };
    }))`,
    returnByValue: true,
  }, s);
  const rects = JSON.parse(result.value);
  if (JSON.stringify(rects.map(r => r.id).filter((id, i, all) => id !== all[i - 1])) !== JSON.stringify(expected)) throw new Error("渲染页面数量或顺序与数据契约不一致");
  const overflow = rects.flatMap((r, i) => r.clip > 0 || r.overlap > 4 || r.spill
    ? [`card-${i + 1}（#${r.id}）：${r.clip > 0 ? `页脚超出底边 ${r.clip}px` : r.overlap > 4 ? `正文与页脚重叠 ${r.overlap}px` : "文字横向越界"}`] : []);
  if (overflow.length && !allowOverflow) throw new Error(`版面溢出，未发布成品：\n${overflow.join("\n")}`);
  if (overflow.length) console.error(`版面溢出（--allow-overflow，照常截图）：\n${overflow.join("\n")}`);
  for (const [i, r] of rects.entries()) {
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } }, s);
    writeFileSync(join(outDir, `card-${i + 1}.png`), Buffer.from(shot.data, "base64"));
  }
  // PDF 用截好的 PNG 拼成，和图片完全一致（直接打印网页时文字阴影会变成色块，绝对定位的元素也会丢）
  const pdfHtml = join(outDir, "pdf.html");
  writeFileSync(pdfHtml, `<!doctype html><style>@page{size:1080px 1440px;margin:0}body{margin:0}img{display:block;width:1080px;height:1440px;break-after:page}img:last-child{break-after:auto}</style>${rects.map((_, i) => `<img src="card-${i + 1}.png">`).join("")}`);
  const pdfLoaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: pathToFileURL(pdfHtml).href }, s);
  await pdfLoaded;
  // PDF 按流分块读回：单条 DevTools 消息超过约 4MB 就收不到回复，整本 PDF 一次返回会卡住
  const { stream } = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, transferMode: "ReturnAsStream" }, s);
  const chunks = [];
  for (let eof = false; !eof;) {
    const r = await send("IO.read", { handle: stream, size: 1 << 20 }, s);
    chunks.push(Buffer.from(r.data, r.base64Encoded ? "base64" : "binary"));
    eof = r.eof;
  }
  await send("IO.close", { handle: stream }, s);
  rmSync(pdfHtml);
  writeFileSync(join(outDir, `${data.masthead.zh}-第${N}期.pdf`), Buffer.concat(chunks));
  // pages.json：第几张图是哪个栏目，讲读稿按它对页
  const keyOf = Object.fromEntries(order.map((key, i) => [expected[i], key]));
  writeFileSync(join(outDir, "pages.json"), JSON.stringify(rects.map((r, i) => ({ card: i + 1, section: keyOf[r.id], id: r.id })), null, 2) + "\n");
  if (!preview) recordBuild(jsonDir, "40-render", inputs, readdirSync(outDir).map(f => join(outDir, f)), outDir);
  publishDirectory(outDir, targetDir, name => name === "issue.html" || name === "build.json" || name === "pages.json" || /^card-\d+\.png$/.test(name) || /-第\d+期\.pdf$/.test(name));
} finally {
  for (const t of timers) clearTimeout(t);
  if (ws && ws.readyState < 2) ws.close();
  if (proc && proc.exitCode === null && proc.signalCode === null) {
    proc.kill();
    await new Promise(ok => {
      const timeout = setTimeout(() => { proc.kill("SIGKILL"); ok(); }, 2000);
      proc.once("exit", () => { clearTimeout(timeout); ok(); });
    });
  }
  if (profile) try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  rmSync(outDir, { recursive: true, force: true });
}
console.log(targetDir);
