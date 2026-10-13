#!/usr/bin/env node
// 用法: node render.mjs <issue.json> [输出目录] [--flat]
// 产出: 输出目录/issue-NNN/{issue.html, card-1..N.png, <刊名>-第NNN期.pdf}；加 --flat 直接写进输出目录
// JSON 里以 .jpg/.jpeg/.png/.webp 结尾、且相对 JSON 所在目录存在的路径，会内嵌进 HTML；.svg 文件按原文内联。
// 截图走 Chrome DevTools 协议，按每张卡片的实际位置裁切，需要 Node 22+（内置 WebSocket）。
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const flat = args.includes("--flat");
const [jsonPath, outRoot = "."] = args.filter(x => x !== "--flat");
if (!jsonPath) { console.error("用法: node render.mjs <issue.json> [输出目录] [--flat]"); process.exit(1); }

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, "..", "assets");
const jsonDir = dirname(resolve(jsonPath));
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const embed = v => {
  if (typeof v === "string") {
    const f = resolve(jsonDir, v);
    if (extname(v).toLowerCase() === ".svg" && existsSync(f)) return readFileSync(f, "utf8");
    return MIME[extname(v).toLowerCase()] && existsSync(f) ? `data:${MIME[extname(v).toLowerCase()]};base64,${readFileSync(f).toString("base64")}` : v;
  }
  if (Array.isArray(v)) return v.map(embed);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "_answers" ? x : embed(x)]));
  return v;
};
const data = embed(JSON.parse(readFileSync(jsonPath, "utf8")));
const N = String(data.issue).padStart(3, "0");
const outDir = flat ? resolve(outRoot) : resolve(outRoot, `issue-${N}`);
mkdirSync(outDir, { recursive: true });

const html = readFileSync(join(assets, "template.html"), "utf8")
  .replace("{{TITLE}}", `${data.masthead.zh} 第${N}期`)
  .replace("{{STYLE}}", () => readFileSync(join(assets, "style.css"), "utf8"))
  .replace("{{CHARACTERS}}", () => readFileSync(join(assets, "characters.js"), "utf8"))
  .replace("{{DATA}}", () => JSON.stringify(data));
const htmlPath = join(outDir, "issue.html");
writeFileSync(htmlPath, html);

const chrome = process.env.CHROME || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
].find(existsSync);
if (!chrome) { console.error("找不到 Chrome，请设置环境变量 CHROME"); process.exit(1); }

const profile = mkdtempSync(join(tmpdir(), "dumpling-"));
const proc = spawn(chrome, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=0",
  `--user-data-dir=${profile}`, ...(process.getuid?.() === 0 ? ["--no-sandbox"] : []), "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((ok, fail) => {
  let buf = "";
  proc.stderr.on("data", d => { const m = (buf += d).match(/DevTools listening on (ws:\S+)/); if (m) ok(m[1]); });
  proc.on("exit", c => fail(new Error(`Chrome 退出 (${c})`)));
});

const ws = new WebSocket(wsUrl);
await new Promise(ok => ws.addEventListener("open", ok, { once: true }));
let seq = 0;
const waiting = new Map(), events = new Map();
ws.addEventListener("message", e => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { const [ok, fail] = waiting.get(m.id); waiting.delete(m.id); m.error ? fail(new Error(m.error.message)) : ok(m.result); }
  else if (m.method && events.has(m.method)) { events.get(m.method)(m.params); events.delete(m.method); }
});
const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
  const id = ++seq; waiting.set(id, [ok, fail]);
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});
const once = method => new Promise(ok => events.set(method, ok));

try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, s);
  await send("Emulation.setDeviceMetricsOverride", { width: 1080, height: 1440, deviceScaleFactor: 1, mobile: false }, s);
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: pathToFileURL(htmlPath).href }, s);
  await loaded;
  await send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => 1)", awaitPromise: true }, s);
  const { result } = await send("Runtime.evaluate", {
    expression: "JSON.stringify([...document.querySelectorAll('.card')].map(c => { const r = c.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; }))",
    returnByValue: true,
  }, s);
  const rects = JSON.parse(result.value);
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
  const pdf = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true }, s);
  rmSync(pdfHtml);
  writeFileSync(join(outDir, `${data.masthead.zh}-第${N}期.pdf`), Buffer.from(pdf.data, "base64"));
} finally {
  ws.close(); proc.kill();
  await new Promise(ok => proc.once("exit", ok));
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
}
console.log(outDir);
