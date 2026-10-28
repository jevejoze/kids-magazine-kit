#!/usr/bin/env node
// 渲染回归：把数据目录里全部目录格式的期用当前引擎渲染一遍，逐张逐像素和基线比对。
// 用法:
//   node regress.mjs baseline <数据目录> <基线目录>             出基线
//   node regress.mjs compare <数据目录> <基线目录> <输出目录>   再渲染一遍，和基线比对；不一致时返回 1
//   加 --only 013,014 只跑这几期
// 每期写到 <目录>/NNN/：cards/（card 图和 PDF）、pixels.json（每张图解码后的像素 md5）、issue.json（按源稿拼出的整期 JSON）。
// 基线和对比图含新闻原图，只能放本地（如引擎的 output/），不进任何仓库。
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { createPipeline } from "./pipeline-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const engine = resolve(here, "..");
const USAGE = "用法: node regress.mjs baseline <数据目录> <基线目录> | compare <数据目录> <基线目录> <输出目录> [--only 013,014]";

export function issuesIn(data) {
  const root = join(data, "issues");
  if (!existsSync(root)) return [];
  return readdirSync(root).filter(n => /^\d{3}$/.test(n) && existsSync(join(root, n, "30-issue.json"))).sort();
}

export function pixelHash(png) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", png, "-pix_fmt", "rgba", "-f", "md5", "-"], { encoding: "utf8" });
  if (r.error || r.status !== 0) throw new Error(`ffmpeg 解码失败：${png}\n${r.error?.message || r.stderr}`);
  return r.stdout.trim().replace(/^MD5=/, "");
}

// 两份 JSON 不同的路径，最多列 limit 条
export function jsonDiff(a, b, path = "", out = [], limit = 20) {
  if (out.length >= limit) return out;
  const kind = v => Array.isArray(v) ? "array" : v === null ? "null" : typeof v;
  if (kind(a) !== kind(b)) { out.push(`${path || "(根)"}：${kind(a)} → ${kind(b)}`); return out; }
  if (kind(a) === "array") {
    if (a.length !== b.length) out.push(`${path}：长度 ${a.length} → ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) jsonDiff(a[i], b[i], `${path}[${i}]`, out, limit);
  } else if (kind(a) === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in b)) out.push(`${p}：被删掉`);
      else if (!(k in a)) out.push(`${p}：新增`);
      else jsonDiff(a[k], b[k], p, out, limit);
    }
  } else if (a !== b) out.push(`${path}：值不同`);
  return out.slice(0, limit);
}

// 渲染失败时取报错那几行（Error: 开头到调用栈之前），不要 Node 打印的源码位置和栈
export function renderError(stderr) {
  const lines = stderr.split("\n");
  const start = lines.findIndex(l => /^\w*Error: /.test(l));
  if (start < 0) return lines.filter(l => l.trim()).slice(-3).join("\n");
  const end = lines.findIndex((l, i) => i > start && /^\s+at /.test(l));
  return lines.slice(start, end < 0 ? undefined : end).join("\n").trim();
}

function render(json, target) {
  return new Promise(ok => {
    const p = spawn(process.execPath, [join(here, "render.mjs"), json, target, "--flat", "--preview", "--allow-overflow"], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", d => err += d);
    p.on("close", code => ok(code === 0 ? null : renderError(err) || `render 退出 ${code}`));
  });
}

// 渲染一期到 <out>/NNN/，返回 { pixels, issue } 或 { error }
async function snapshot(data, n, out) {
  const src = join(data, "issues", n), dir = join(out, n), cards = join(dir, "cards");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let issue;
  try { issue = JSON.parse(JSON.stringify(createPipeline(src).buildIssue())); }
  catch (e) { issue = { _error: e.message }; }
  writeFileSync(join(dir, "issue.json"), JSON.stringify(issue, null, 2) + "\n");
  const error = await render(join(src, "30-issue.json"), cards);
  if (error) { writeFileSync(join(dir, "error.txt"), error + "\n"); return { error }; }
  const pngs = readdirSync(cards).filter(f => /^card-\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)));
  const pixels = Object.fromEntries(pngs.map(f => [f, pixelHash(join(cards, f))]));
  writeFileSync(join(dir, "pixels.json"), JSON.stringify(pixels, null, 2) + "\n");
  return { pixels, issue };
}

function load(dir, n) {
  const d = join(dir, n), read = f => existsSync(join(d, f)) ? JSON.parse(readFileSync(join(d, f), "utf8")) : null;
  if (existsSync(join(d, "error.txt"))) return { error: readFileSync(join(d, "error.txt"), "utf8").trim() };
  return { pixels: read("pixels.json"), issue: read("issue.json") };
}

// 比对一期，返回问题列表（空 = 一致）
export function compareIssue(base, now) {
  if (!base.pixels && !base.error) return ["基线里没有这一期"];
  if (base.error || now.error) return base.error === now.error ? [] : [`渲染结果不同：基线 ${base.error ? "失败" : "成功"}，现在 ${now.error ? `失败：${now.error}` : "成功"}`];
  const problems = [];
  const names = new Set([...Object.keys(base.pixels), ...Object.keys(now.pixels)]);
  for (const f of names) {
    if (!(f in now.pixels)) problems.push(`${f} 不见了`);
    else if (!(f in base.pixels)) problems.push(`${f} 是多出来的`);
    else if (base.pixels[f] !== now.pixels[f]) problems.push(`${f} 像素不一致`);
  }
  problems.push(...jsonDiff(base.issue, now.issue).map(d => `整期 JSON ${d}`));
  return problems;
}

async function pool(items, size, fn) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (i < items.length) { const k = i++; results[k] = await fn(items[k]); } }));
  return results;
}

// 输出目录在引擎仓库里时只能放 output/ 下面，免得新闻原图混进公开仓库
function guard(dir) {
  const rel = relative(engine, dir);
  if (!rel.startsWith("..") && !isAbsolute(rel) && rel.split(/[\\/]/)[0] !== "output") throw new Error(`${dir} 在引擎仓库里，请放到 output/ 下面或仓库外`);
}

async function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf("--only");
  const only = at >= 0 ? args.splice(at, 2)[1]?.split(",").map(s => s.trim().padStart(3, "0")) : null;
  const [cmd, dataArg, baseArg, outArg] = args;
  if (!["baseline", "compare"].includes(cmd) || !dataArg || !baseArg || (cmd === "compare" && !outArg)) { console.error(USAGE); process.exit(2); }
  const data = resolve(dataArg), base = resolve(baseArg), out = cmd === "compare" ? resolve(outArg) : base;
  guard(out);
  if (cmd === "compare" && out === base) throw new Error("输出目录不能和基线目录相同");
  const issues = issuesIn(data).filter(n => !only || only.includes(n));
  if (!issues.length) throw new Error(`${data}/issues 下没有目录格式的期`);
  // 并发多了 Chrome 偶尔会出抗锯齿略有不同的一版（12 路同时渲染时见过），所以只开 2 路，
  // 出基线时每期渲两遍、必须逐像素一致；比对时不一致就重渲一次再判
  const recheck = join(out, ".recheck");
  const snaps = await pool(issues, 2, async n => {
    const now = await snapshot(data, n, out);
    if (cmd === "baseline") return { ...now, unstable: compareIssue(now, await snapshot(data, n, recheck)).length > 0 };
    return compareIssue(load(base, n), now).length ? snapshot(data, n, out) : now;
  });
  rmSync(recheck, { recursive: true, force: true });
  let bad = 0, failed = 0;
  for (const [i, n] of issues.entries()) {
    const now = snaps[i];
    if (cmd === "baseline") {
      if (now.unstable) { bad++; console.log(`❌ ${n} 同一引擎渲两遍不一致，重跑基线`); }
      else if (now.error) { failed++; console.log(`⚠️  ${n} 渲染失败（比对时要求同样失败）：${now.error}`); }
      else console.log(`✅ ${n} ${Object.keys(now.pixels).length} 张${now.issue._error ? `（整期 JSON 拼不出来：${now.issue._error}）` : ""}`);
      continue;
    }
    const problems = compareIssue(load(base, n), now);
    if (problems.length) { bad++; console.log(`❌ ${n}\n${problems.map(p => `   ${p}`).join("\n")}`); }
    else console.log(`✅ ${n} 一致`);
  }
  if (cmd === "baseline") console.log(bad ? `${bad} 期两遍渲染不一致，基线不可用` : `基线写在 ${base}，${issues.length} 期${failed ? `（${failed} 期渲染失败）` : ""}`);
  else console.log(bad ? `${bad} 期和基线不一致，对比图在 ${out}` : `${issues.length} 期全部和基线一致`);
  process.exitCode = bad ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(2); });
}
