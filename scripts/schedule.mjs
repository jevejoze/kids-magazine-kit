// 杂志配置和调度：magazine.yaml + 日期 + 课表 → brief 的 sections（本期出哪些栏目、顺序、合并后的 params）
//   loadMagazine(dataDir, registry)   读 data/magazine.yaml，没有就用默认配置；校验不过抛错，错误逐条列出
//   schedule({ magazine, date, dataDir, issueNo, registry })   算出本期的 weekday_theme 和 sections
//   scheduleIssue(issueDir, date?)   第 00 步用：算好写进 00-brief.json（没有就新建），返回写进去的内容
// 栏目迁移成 sections/ 栏目包之前，旧版页面用下面的 LEGACY 表当 manifest
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./yaml.mjs";
import { checkParamValue, loadSections } from "./sections.mjs";
import { PAGE_KEYS, NARRATION_MAX_LINES, SPEAKERS } from "./contracts.mjs";

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAY_ZH = { 日: "sun", 天: "sun", 一: "mon", 二: "tue", 三: "wed", 四: "thu", 五: "fri", 六: "sat" };
const POLICIES = ["free-only", "private-ok"];
const SERIAL_KINDS = ["book", "music", "film", "make"];
const lines = (id, max = 60) => ({ type: "number", default: NARRATION_MAX_LINES[id], min: 1, max });
const text = { type: "string", default: "" };

// 旧版页面的伪 manifest。stage：对应的流水线步骤；required：旧模板必须有这一页；optional：可选栏目（家长写进 sections 才做）
// rules：要守的 core/rules（红线由任务单自动加）；consumes：要读的上游值；state：跨期状态文件
// params 里 open 的才能在 magazine.yaml 里改；其余由调度填（周五轮换、课表）
export const LEGACY = {
  cover:     { stage: "10-cover",    required: true, rules: ["images"], params: { narration_lines: lines("cover") } },
  comic:     { stage: "11-comic",    required: true, consumes: ["cover.question"], params: { narration_lines: lines("comic") } },
  creature:  { stage: "09-creature", rules: ["images"], state: { file: "creature-log.md" }, params: { narration_lines: lines("creature") } },
  words:     { stage: "12-words",    optional: true, rules: ["english-level"], params: { narration_lines: lines("words") } },
  story:     { stage: "13-story",    required: true, state: { file: "story-bible.md" }, params: { narration_lines: lines("story") } },
  challenge: { stage: "14-puzzle",   required: true, params: { narration_lines: lines("challenge") } },
  english:   { stage: "15-english",  optional: true, rules: ["english-level"], params: {} },
  news:      { stage: "17-news",     rules: ["images", "english-level"], params: { narration_lines: lines("news") } },
  check:     { stage: "19-check",    rules: ["no-visible-pedagogy"], params: { narration_lines: lines("check"), skill: text, choices: text, tools: text } },
  serial:    { stage: "18-serial",   rules: ["images", "english-level"], state: { file: "serial-bible.md" }, params: { narration_lines: lines("serial"), kind: { type: "string", default: "book", enum: SERIAL_KINDS } } },
  think:     { stage: "08-think",    rules: ["no-visible-pedagogy"], state: { file: "think-log.md" }, params: { narration_lines: lines("think"), skill: text, friday_topic: text } },
  mailbox:   { stage: "16-mailbox",  required: true, params: { narration_lines: lines("mailbox") } },
};
// 首批开放给家长改的参数；周五轮换在 schedule.friday 里写
const OPEN = ["narration_lines", "image_policy"];
// 旧任务书用布尔字段决定的栏目（没有 sections 的旧期照旧读 brief.creature、brief.think）
export const DAY_SECTIONS = ["creature", "think"];

export const DEFAULT_MAGAZINE = {
  image_policy: "private-ok",
  cast: "default",
  sections: ["cover", "comic", "creature", "story", "challenge", "news", "check", "serial", "think", "mailbox"],
  schedule: {
    weekday_theme: { mon: "自然科学", tue: "历史人物", wed: "世界各地", thu: "数学趣题", fri: "艺术手工", sat: "亲子小实验", sun: "周刊回顾" },
    days: { creature: ["mon"], think: ["fri"] },
    friday: { serial: ["make", "music", "make", "film"] },
  },
  curriculum: "thinking-plan.md",
  params: {},
};

const TOP = ["masthead", "call", "send_note", "english_level", "image_policy", "cast", "sections", "schedule", "curriculum", "params", "voices"];
const isMap = v => v && typeof v === "object" && !Array.isArray(v);

// 一个栏目可用的参数声明：旧版用 LEGACY，栏目包用 manifest（讲读句数取 narration.lines），都带 image_policy
function declared(id, registry) {
  const pack = registry.find(s => s.id === id);
  if (pack) {
    const m = pack.manifest, params = { ...(m.params ?? {}) };
    if (m.narration) params.narration_lines = { type: "number", default: m.narration.lines, min: 1, max: 60 };
    return { params, open: Object.keys(params), policy: m.image_policy ?? null };
  }
  return { params: LEGACY[id].params, open: OPEN.filter(k => k in LEGACY[id].params), policy: null };
}

export function validateMagazine(m, registry = []) {
  if (!isMap(m)) return ["magazine.yaml 顶层要是 map"];
  const errors = [], known = [...Object.keys(LEGACY), ...registry.map(s => s.id)];
  const extra = Object.keys(m).filter(k => !TOP.includes(k));
  if (extra.length) errors.push(`未知的配置项：${extra.join("、")}（可写：${TOP.join("、")}）`);
  if ("masthead" in m && !(isMap(m.masthead) && Object.entries(m.masthead).every(([k, v]) => ["zh", "en", "by"].includes(k) && typeof v === "string")))
    errors.push("masthead 写成 zh / en / by 三个字符串");
  for (const k of ["call", "send_note", "cast"]) if (k in m && typeof m[k] !== "string") errors.push(`${k} 要是字符串`);
  if ("english_level" in m && !["L1", "L2", "L3"].includes(m.english_level)) errors.push("english_level 要是 L1 / L2 / L3");
  if ("image_policy" in m && !POLICIES.includes(m.image_policy)) errors.push(`image_policy 要是 ${POLICIES.join(" / ")}`);
  if ("curriculum" in m && m.curriculum !== null && typeof m.curriculum !== "string") errors.push("curriculum 写课表文件的路径（相对数据目录），不用课表写 null");

  const sections = m.sections ?? DEFAULT_MAGAZINE.sections;
  if (!Array.isArray(sections) || !sections.length || !sections.every(s => typeof s === "string")) {
    errors.push("sections 要是栏目 id 的列表");
    return errors;
  }
  const unknown = sections.filter(s => !known.includes(s));
  if (unknown.length) errors.push(`未知栏目：${unknown.join("、")}（可用：${known.join("、")}）`);
  const dup = sections.filter((s, i) => sections.indexOf(s) !== i);
  if (dup.length) errors.push(`栏目重复：${[...new Set(dup)].join("、")}`);
  const missing = Object.keys(LEGACY).filter(id => LEGACY[id].required && !sections.includes(id));
  if (missing.length) errors.push(`旧版模板必须有这几页：${missing.join("、")}`);
  // 旧版页面的顺序由模板定：栏目包排在信箱前面，其余按旧页序
  const pages = sections.filter(s => known.includes(s) && s !== "english");
  const rendered = [...PAGE_KEYS.slice(0, -1), ...pages.filter(s => !PAGE_KEYS.includes(s)), PAGE_KEYS.at(-1)].filter(s => pages.includes(s));
  if (!unknown.length && !dup.length && rendered.join() !== pages.join())
    errors.push(`旧版页面还不能调顺序，现在只能排成：${rendered.join("、")}`);
  const listed = id => sections.includes(id);

  const sch = m.schedule ?? {};
  if (!isMap(sch)) errors.push("schedule 要是 map（weekday_theme、days、friday）");
  else {
    const badKeys = Object.keys(sch).filter(k => !["weekday_theme", "days", "friday"].includes(k));
    if (badKeys.length) errors.push(`schedule 里未知的项：${badKeys.join("、")}`);
    if ("weekday_theme" in sch && !(isMap(sch.weekday_theme) && Object.entries(sch.weekday_theme).every(([k, v]) => WEEKDAYS.includes(k) && typeof v === "string")))
      errors.push(`schedule.weekday_theme 的键是 ${WEEKDAYS.join(" ")}，值是主题文字`);
    if ("days" in sch) {
      if (!isMap(sch.days)) errors.push("schedule.days 写成 栏目: [星期, ...]");
      else for (const [id, days] of Object.entries(sch.days)) {
        if (!listed(id)) errors.push(`schedule.days.${id}：sections 里没有这个栏目`);
        if (!Array.isArray(days) || !days.length || !days.every(d => WEEKDAYS.includes(d))) errors.push(`schedule.days.${id} 要是星期列表（${WEEKDAYS.join(" ")}）`);
      }
    }
    if ("friday" in sch) {
      if (!isMap(sch.friday)) errors.push("schedule.friday 写成 serial: [轮换顺序]");
      else for (const [id, list] of Object.entries(sch.friday)) {
        if (id !== "serial") { errors.push(`schedule.friday.${id}：周五轮换目前只开放 serial`); continue; }
        if (!listed("serial")) errors.push("schedule.friday.serial：sections 里没有 serial");
        if (!Array.isArray(list) || !list.every(k => SERIAL_KINDS.includes(k))) errors.push(`schedule.friday.serial 要是 ${SERIAL_KINDS.join(" / ")} 组成的列表`);
      }
    }
  }

  const policy = m.image_policy ?? DEFAULT_MAGAZINE.image_policy;
  for (const id of sections.filter(s => known.includes(s))) {
    const d = declared(id, registry);
    if (d.policy === "private-ok" && policy === "free-only") errors.push(`栏目 ${id} 要用新闻原图（image_policy: private-ok），和全刊的 free-only 冲突`);
  }
  if ("params" in m) {
    if (!isMap(m.params)) errors.push("params 写成 栏目: {参数: 值}");
    else for (const [id, values] of Object.entries(m.params)) {
      if (!listed(id)) { errors.push(`params.${id}：sections 里没有这个栏目`); continue; }
      if (!known.includes(id)) continue;
      if (!isMap(values)) { errors.push(`params.${id} 要是 map`); continue; }
      const d = declared(id, registry);
      for (const [k, v] of Object.entries(values)) {
        const at = `params.${id}.${k}`;
        if (k === "image_policy") {
          if (!POLICIES.includes(v)) errors.push(`${at} 要是 ${POLICIES.join(" / ")}`);
          else if (policy === "free-only" && v === "private-ok") errors.push(`${at}：全刊是 free-only，单个栏目不能放宽成 private-ok`);
          continue;
        }
        if (!(k in d.params)) { errors.push(`${at}：栏目没有声明这个参数（有：${Object.keys(d.params).join("、") || "无"}）`); continue; }
        if (!d.open.includes(k)) { errors.push(`${at}：这个参数由调度填写，不在 magazine.yaml 里改`); continue; }
        errors.push(...checkParamValue(at, d.params[k], v));
      }
    }
  }
  if ("voices" in m && !(isMap(m.voices) && Object.entries(m.voices).every(([k, v]) => SPEAKERS.includes(k) && isMap(v))))
    errors.push(`voices 的键是 ${SPEAKERS.join(" / ")}，每个写成 map（如 zh: 声音名）`);
  return errors;
}

export function loadMagazine(dataDir, registry = []) {
  const file = join(dataDir, "magazine.yaml");
  const raw = existsSync(file) ? parseYaml(readFileSync(file, "utf8")) : {};
  const errors = validateMagazine(raw, registry);
  if (errors.length) throw new Error(`magazine.yaml 有问题：\n- ${errors.join("\n- ")}`);
  return {
    ...DEFAULT_MAGAZINE, ...raw,
    schedule: { ...DEFAULT_MAGAZINE.schedule, ...(raw.schedule ?? {}) },
    params: raw.params ?? {},
  };
}

// "2026.10.14 周三"、"2026-10-14" → { iso, weekday }
export function parseDate(value) {
  const m = String(value ?? "").match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) throw new Error(`日期看不懂：${value}（写成 YYYY-MM-DD 或 YYYY.MM.DD）`);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1) throw new Error(`没有这一天：${value}`);
  const weekday = WEEKDAYS[d.getUTCDay()];
  const zh = String(value).match(/周([日天一二三四五六])/)?.[1];
  if (zh && WEEKDAY_ZH[zh] !== weekday) throw new Error(`${value}：日期和星期对不上，这天是${Object.keys(WEEKDAY_ZH).find(k => WEEKDAY_ZH[k] === weekday && k !== "天")}`);
  return { iso: d.toISOString().slice(0, 10), weekday, time: d.getTime() };
}

// 课表：markdown 表格，按「周一日期」找本周那一行；"默认"开头的格子用默认值
export function curriculumWeek(file, date) {
  if (!file || !existsSync(file)) return null;
  const rows = readFileSync(file, "utf8").split("\n").filter(l => /^\s*\|/.test(l))
    .map(l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim()));
  const header = rows.find(r => r.some(c => c.includes("周一日期")));
  if (!header) return null;
  const col = name => header.findIndex(c => c.includes(name));
  const at = { monday: col("周一日期"), skill: col("本领"), choices: col("选项"), tools: col("查证工具"), friday: col("周五接") };
  const { time } = parseDate(date);
  for (const r of rows.slice(rows.indexOf(header) + 1)) {
    if (r.every(c => /^:?-+:?$/.test(c))) continue;
    let start;
    try { start = parseDate(r[at.monday]).time; } catch { continue; }
    if (time < start || time >= start + 7 * 86400e3) continue;
    const cell = k => { const v = at[k] >= 0 ? r[at[k]] ?? "" : ""; return v.startsWith("默认") ? "" : v; };
    return { skill: cell("skill"), choices: cell("choices"), tools: cell("tools"), friday_topic: cell("friday") };
  }
  return null;
}

// 周五轮换到第几个：之前各期里周五出过几次非 book（读每期 00-brief 的 sections.serial.params.kind，旧期读 serial.kind）
function fridayCount(dataDir, issueNo) {
  const dir = join(dataDir, "issues");
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(n => /^\d{3}$/.test(n) && +n < issueNo).filter(n => {
    try {
      const b = JSON.parse(readFileSync(join(dir, n, "00-brief.json"), "utf8"));
      const kind = b.sections?.serial?.params?.kind ?? b.serial?.kind ?? "book";
      return kind !== "book";
    } catch { return false; }
  }).length;
}

export function schedule({ magazine, date, dataDir, issueNo, registry = [] }) {
  const { weekday } = parseDate(date);
  const sch = magazine.schedule;
  const ids = magazine.sections.filter(id => !sch.days?.[id] || sch.days[id].includes(weekday));
  const week = magazine.curriculum ? curriculumWeek(join(dataDir, magazine.curriculum), date) : null;
  const sections = {};
  for (const id of ids) {
    const { params: decl } = declared(id, registry);
    const params = Object.fromEntries(Object.entries(decl).map(([k, p]) => [k, p.default]));
    if (id === "challenge" && ids.includes("english")) params.narration_lines = 18;
    params.image_policy = magazine.image_policy;
    Object.assign(params, magazine.params[id] ?? {});
    if (id === "serial" && weekday === "fri" && sch.friday?.serial?.length)
      params.kind = sch.friday.serial[fridayCount(dataDir, issueNo) % sch.friday.serial.length];
    if (week && id === "check") Object.assign(params, { skill: week.skill, choices: week.choices, tools: week.tools });
    if (week && id === "think") Object.assign(params, { skill: week.skill, friday_topic: week.friday_topic });
    sections[id] = { params };
  }
  return { weekday, weekday_theme: sch.weekday_theme?.[weekday] ?? "", sections };
}

// 一个栏目本期出不出：true / false；旧任务书没有 sections 时返回 undefined（由调用方照旧规则判断）
export function scheduledIn(brief, id) {
  if (!id) return undefined;
  if (isMap(brief?.sections)) return Object.hasOwn(brief.sections, id);
  if (DAY_SECTIONS.includes(id) && typeof brief?.[id] === "boolean") return brief[id];
  return undefined;
}

// 写进任务书：sections、weekday_theme，以及旧字段 creature、think（还没迁移的步骤照旧读它们）
export function scheduleIssue(issueDir, date) {
  issueDir = resolve(issueDir);
  const dataDir = resolve(issueDir, "..", ".."), file = join(issueDir, "00-brief.json");
  const issueNo = Number(basename(issueDir));
  if (!Number.isInteger(issueNo)) throw new Error(`期号文件夹要是三位数字：${issueDir}`);
  const brief = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { issue: issueNo };
  date ??= brief.date;
  if (!date) throw new Error("没有日期：任务书里还没写 date，就在命令后面加上日期（YYYY-MM-DD）");
  const { errors, sections: registry } = loadSections({ engine: resolve(dirname(fileURLToPath(import.meta.url)), ".."), data: dataDir });
  if (errors.length) throw new Error(`栏目注册表有问题：\n- ${errors.join("\n- ")}`);
  const magazine = loadMagazine(dataDir, registry);
  const result = schedule({ magazine, date, dataDir, issueNo, registry });
  const { iso, weekday } = parseDate(date);
  const zh = { sun: "日", mon: "一", tue: "二", wed: "三", thu: "四", fri: "五", sat: "六" }[weekday];
  const next = {
    ...brief,
    date: brief.date && parseDate(brief.date).iso === iso ? brief.date : `${iso.replaceAll("-", ".")} 周${zh}`,
    weekday_theme: result.weekday_theme,
    creature: "creature" in result.sections,
    think: "think" in result.sections,
    sections: result.sections,
  };
  if (next.serial && result.sections.serial) next.serial = { ...next.serial, kind: result.sections.serial.params.kind };
  mkdirSync(issueDir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  try { writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n"); renameSync(tmp, file); }
  finally { rmSync(tmp, { force: true }); }
  return next;
}
