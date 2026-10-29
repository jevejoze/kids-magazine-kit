// 栏目注册表：从引擎和数据仓库两处的 sections/ 读出栏目包，校验 manifest、page.js 和 page.css。
// 栏目包：sections/<id>/{SKILL.md, manifest.json, schema.json, check.mjs, page.js, page.css, narrate.md}
// 渲染时注册了的栏目走自己的 page.js + page.css，其余仍走 assets/template.html 里的旧栏目代码。
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGE_KEYS, CARD_IDS } from "./contracts.mjs";

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
const ID = /^[a-z][a-z0-9-]*$/;
const PARAM_TYPES = ["string", "number", "boolean", "list"];
const FIELDS = ["id", "title", "consumes", "params", "rules", "image_policy", "narration", "state"];
const strings = v => Array.isArray(v) && v.every(x => typeof x === "string" && x.trim());

export function validateParam(name, p) {
  const at = `params.${name}`;
  if (!p || typeof p !== "object" || Array.isArray(p)) return [`${at} 必须是对象（type、default，可选 min/max/enum）`];
  const errors = [], unknown = Object.keys(p).filter(k => !["type", "default", "min", "max", "enum"].includes(k));
  if (unknown.length) errors.push(`${at} 有未声明的字段：${unknown.join("、")}`);
  if (!PARAM_TYPES.includes(p.type)) return [...errors, `${at}.type 要是 ${PARAM_TYPES.join(" / ")}`];
  const fits = v => p.type === "list" ? Array.isArray(v) : typeof v === p.type && (p.type !== "number" || Number.isFinite(v));
  if (!("default" in p) || !fits(p.default)) errors.push(`${at}.default 必须是 ${p.type}`);
  for (const k of ["min", "max"]) if (k in p && (p.type !== "number" || !Number.isFinite(p[k]))) errors.push(`${at}.${k} 只用于 number，且必须是数字`);
  if ("min" in p && "max" in p && p.min > p.max) errors.push(`${at}.min 大于 max`);
  if (p.type === "number" && Number.isFinite(p.default) && (p.default < (p.min ?? -Infinity) || p.default > (p.max ?? Infinity))) errors.push(`${at}.default 超出 min–max`);
  if ("enum" in p && (!Array.isArray(p.enum) || !p.enum.length || !p.enum.every(fits))) errors.push(`${at}.enum 要是非空数组，每项都是 ${p.type}`);
  else if (p.enum && "default" in p && !p.enum.includes(p.default)) errors.push(`${at}.default 不在 enum 里`);
  return errors;
}

// 家长给的参数值是否符合声明：类型、min/max、enum
export function checkParamValue(name, p, v) {
  const fits = p.type === "list" ? Array.isArray(v) : typeof v === p.type && (p.type !== "number" || Number.isFinite(v));
  if (!fits) return [`${name} 要是 ${p.type}`];
  if (p.type === "number" && (v < (p.min ?? -Infinity) || v > (p.max ?? Infinity))) return [`${name} = ${v} 超出范围 ${p.min ?? "-∞"}–${p.max ?? "∞"}`];
  if (p.enum && !p.enum.includes(v)) return [`${name} = ${JSON.stringify(v)} 不在可选值里：${p.enum.join(" / ")}`];
  return [];
}

// manifest 校验：缺字段、类型不对、多出未声明的字段都报错，返回错误列表
export function validateManifest(m) {
  if (!m || typeof m !== "object" || Array.isArray(m)) return ["manifest 顶层必须是对象"];
  const errors = [];
  const extra = Object.keys(m).filter(k => !FIELDS.includes(k));
  if (extra.length) errors.push(`有未声明的字段：${extra.join("、")}`);
  const missing = FIELDS.filter(k => !(k in m));
  if (missing.length) errors.push(`缺字段：${missing.join("、")}`);
  if ("id" in m && (typeof m.id !== "string" || !ID.test(m.id))) errors.push("id 要是小写字母开头的 kebab-case");
  if ("title" in m && (typeof m.title !== "string" || !m.title.trim())) errors.push("title 必须是非空字符串");
  if ("consumes" in m && !strings(m.consumes)) errors.push("consumes 必须是字符串数组（如 cover.question）");
  if ("rules" in m && !strings(m.rules)) errors.push("rules 必须是字符串数组");
  if ("params" in m) {
    if (!m.params || typeof m.params !== "object" || Array.isArray(m.params)) errors.push("params 必须是对象");
    else for (const [k, p] of Object.entries(m.params)) errors.push(...validateParam(k, p));
  }
  if ("image_policy" in m && !["free-only", "private-ok"].includes(m.image_policy)) errors.push("image_policy 要是 free-only 或 private-ok");
  if ("narration" in m && !(m.narration && Number.isInteger(m.narration.lines) && m.narration.lines > 0 && Object.keys(m.narration).length === 1))
    errors.push("narration 要写成 {\"lines\": 正整数}");
  if ("state" in m && !(m.state === null || (m.state && typeof m.state === "object" && !Array.isArray(m.state) && typeof m.state.file === "string" && m.state.file.trim())))
    errors.push("state 写 null（不跨期记状态），或 {\"file\": \"数据目录里的状态文件\", ...}");
  return errors;
}

// 选择器列表按顶层逗号拆开（括号里的逗号不拆）
function selectors(prelude) {
  const out = [];
  let depth = 0, cur = "";
  for (const c of prelude) {
    if (c === "(" || c === "[") depth++;
    if (c === ")" || c === "]") depth--;
    if (c === "," && !depth) { out.push(cur.trim()); cur = ""; } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// page.css 的每条选择器都要以 #<id> 开头；@media、@supports 里面照样检查，@keyframes、@font-face 不算
export function checkCssScope(css, id) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, ""), bad = [];
  const scope = new RegExp(`^#${id}(?![\\w-])`);
  let i = 0;
  const block = () => {
    while (i < src.length) {
      const open = src.indexOf("{", i), close = src.indexOf("}", i);
      if (close >= 0 && (open < 0 || close < open)) { i = close + 1; return; }
      if (open < 0) return;
      const prelude = src.slice(i, open).trim();
      i = open + 1;
      if (/^@(media|supports|layer|container)\b/.test(prelude)) block();
      else if (prelude.startsWith("@")) skip();
      else { bad.push(...selectors(prelude).filter(s => !scope.test(s))); skip(); }
    }
  };
  const skip = () => { for (let depth = 1; i < src.length && depth; i++) depth += src[i] === "{" ? 1 : src[i] === "}" ? -1 : 0; };
  block();
  return bad;
}

// page.js 在页面里以普通脚本内联运行：只用 kit，不 import；要导出 render(data, kit)
export function checkPageScript(js) {
  const errors = [];
  if (/^\s*import\b/m.test(js)) errors.push("page.js 不能 import，用 render(data, kit) 拿到的 kit");
  if (!/^export\s+function\s+render\s*\(/m.test(js)) errors.push("page.js 要导出 export function render(data, kit)");
  if (/^export\s+(?!function\s+render\b)/m.test(js)) errors.push("page.js 只导出 render");
  return errors;
}

function readDir(root, origin) {
  const dir = join(root, "sections");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(n => !n.startsWith(".") && statSync(join(dir, n)).isDirectory()).sort().map(name => ({ name, origin, dir: join(dir, name) }));
}

// 读出注册表：{ sections: [{id, origin, dir, manifest, script, css}], errors }。有错时 sections 不可用
export function loadSections({ engine, data } = {}) {
  const found = [...(engine ? readDir(engine, "engine") : []), ...(data ? readDir(data, "data") : [])];
  const errors = [], sections = [], seen = new Map();
  for (const { name, origin, dir } of found) {
    const at = `${origin === "engine" ? "引擎" : "数据仓库"} sections/${name}`;
    const file = f => join(dir, f);
    if (!existsSync(file("manifest.json"))) { errors.push(`${at}：缺 manifest.json`); continue; }
    let manifest;
    try { manifest = JSON.parse(readFileSync(file("manifest.json"), "utf8")); }
    catch (e) { errors.push(`${at}/manifest.json 不是合法 JSON：${e.message}`); continue; }
    const own = validateManifest(manifest).map(e => `${at}/manifest.json：${e}`);
    if (manifest?.id !== undefined && manifest.id !== name) own.push(`${at}：manifest 的 id「${manifest.id}」要和目录名一致`);
    if (seen.has(name)) own.push(seen.get(name) === "engine" && origin === "data"
      ? `${at}：引擎里已有栏目「${name}」，数据仓库只能新增栏目，不能覆盖`
      : `${at}：栏目「${name}」重名`);
    else if (origin === "data" && (PAGE_KEYS.includes(name) || Object.values(CARD_IDS).includes(name))) own.push(`${at}：「${name}」是引擎的栏目，数据仓库只能新增栏目，不能覆盖`);
    const script = existsSync(file("page.js")) ? readFileSync(file("page.js"), "utf8") : null;
    if (script === null) own.push(`${at}：缺 page.js`);
    else own.push(...checkPageScript(script).map(e => `${at}/${e}`));
    const css = existsSync(file("page.css")) ? readFileSync(file("page.css"), "utf8") : "";
    const unscoped = checkCssScope(css, name);
    if (unscoped.length) own.push(`${at}/page.css：选择器要以 #${name} 开头：${unscoped.join("、")}`);
    seen.set(name, seen.get(name) ?? origin);
    errors.push(...own);
    if (!own.length) sections.push({ id: name, origin, dir, manifest, script, css });
  }
  return { sections, errors };
}

// 本期的页序：旧页序里有数据的键；注册了而旧页序里没有的新栏目，有数据就排在信箱前面
export function sectionOrder(issue, sections = []) {
  const extra = sections.map(s => s.id).filter(id => !PAGE_KEYS.includes(id));
  const keys = [...PAGE_KEYS.slice(0, -1), ...extra, PAGE_KEYS.at(-1)];
  return keys.filter(key => issue[key] != null);
}

// 一个栏目在页面里的 id：注册了的用栏目 id，其余用旧模板的卡片 id
export const sectionDomId = (key, sections = []) => sections.some(s => s.id === key) ? key : CARD_IDS[key];

// 内联进页面的脚本：每个注册栏目的 page.js 包成一个函数，登记到 SECTIONS
export function sectionScripts(sections) {
  return sections.map(s => `SECTIONS[${JSON.stringify(s.id)}] = (() => {\n${s.script.replace(/^export\s+function\s+render\b/m, "function render")}\nreturn { render };\n})();`).join("\n");
}

// 拼出整期的 issue.html：模板里的 {{占位}} 一次替换完，填进去的内容（数据、栏目脚本）不会再被当成占位
export function issueHtml({ data, sections = [], characterPack = null, title = "", characters } = {}) {
  const asset = f => readFileSync(join(ASSETS, f), "utf8");
  const order = sectionOrder(data, sections);
  const values = {
    TITLE: title,
    STYLE: [asset("style.css"), ...sections.map(s => s.css)].join("\n"),
    CHARACTER_PACK: JSON.stringify(characterPack),
    CHARACTERS: characters ?? asset("characters.js"),
    DATA: JSON.stringify(data),
    KIT: asset("kit.js"),
    SECTIONS: sectionScripts(sections),
    PAGE_ORDER: JSON.stringify(order),
    CARD_IDS: JSON.stringify(order.map(key => sectionDomId(key, sections))),
  };
  return asset("template.html").replace(/\{\{([A-Z_]+)\}\}/g, (all, key) => key in values ? values[key] : all);
}
