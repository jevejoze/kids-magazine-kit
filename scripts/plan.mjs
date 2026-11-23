// 选题卡校验、任务书快照和执行降级。
import { createHash } from "node:crypto";
import { hostname } from "node:os";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWrite } from "./build-state.mjs";
import { loadMagazine, parseDate, schedule } from "./schedule.mjs";
import { loadSections } from "./sections.mjs";
import { newsCount } from "../sections/news/check.mjs";
import { parseYaml } from "./yaml.mjs";
import { cardTopic, compareTopics, isDate, isMap, isText, isUrl, readJson, stripTags, topicContext, urlKey } from "./topics.mjs";

const ENGINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DAY = 86400e3;
const SECTIONS = ["cover", "check", "news"];
const iso = time => new Date(time).toISOString().slice(0, 10);
export const addDays = (date, days) => iso(Date.parse(date) + days * DAY);
export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function isoWeek(date) {
  const weekday = new Date(date).getUTCDay() || 7;
  const thursday = addDays(date, 4 - weekday), year = thursday.slice(0, 4);
  const week = Math.ceil(((Date.parse(thursday) - Date.parse(`${year}-01-01`)) / DAY + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}
function weekStart(week) {
  if (typeof week !== "string" || !/^\d{4}-W\d{2}$/.test(week)) return null;
  const january4 = `${week.slice(0, 4)}-01-04`;
  const monday = addDays(january4, 1 - (new Date(january4).getUTCDay() || 7) + 7 * (Number(week.slice(6)) - 1));
  return isoWeek(monday) === week ? monday : null;
}

export function loadAgent(dataDir) {
  const file = join(dataDir, ".agent.yaml");
  const config = existsSync(file) ? parseYaml(readFileSync(file, "utf8")) : {};
  if (!isMap(config)) throw new Error(".agent.yaml 要写成含 role 和 name 的对象");
  const role = process.env.KIDS_MAG_ROLE ?? config.role;
  const roles = typeof role === "string" ? role.split(",").map(s => s.trim()) : role ?? [];
  const name = process.env.KIDS_MAG_AGENT ?? config.name ?? hostname();
  if (!isText(name)) throw new Error(".agent.yaml 的 name 或 KIDS_MAG_AGENT 要是非空字符串");
  return { roles, name };
}

function loadPlan(file, week) {
  const plan = readJson(file);
  if (!isMap(plan) || plan.week !== week || !isMap(plan.days))
    throw new Error(`${file} 的 week 要等于 ${week}，days 要是对象`);
  return plan;
}

export function readPlan(dataDir, week) {
  if (!weekStart(week)) throw new Error(`ISO 周看不懂：${week}（写成 YYYY-Www）`);
  const file = join(dataDir, "plan", `${week}.json`);
  return existsSync(file) ? loadPlan(file, week) : null;
}

export function planDay(plan, date) {
  if (!plan || !Object.hasOwn(plan.days, date)) return null;
  const day = plan.days[date];
  if (!isMap(day) || !["draft", "ready"].includes(day.status) || !isMap(day.cover)
    || !Array.isArray(day.news) || !day.news.every(isMap) || (day.check !== undefined && !isMap(day.check)))
    throw new Error(`${plan.week} 的 ${date} 选题卡结构不对，请跑 plan-check`);
  return day;
}

export function snapshotPlan(dataDir, date) {
  const week = isoWeek(date), day = planDay(readPlan(dataDir, week), date);
  return { ...day, week, date, status: day?.status ?? "missing", fallback: [] };
}

export function issueBriefs(dataDir) {
  const dir = join(dataDir, "issues");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory() && /^\d{3}$/.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name)).map(({ name }) => {
      const issue = `issues/${name}`, file = join(dataDir, issue, "brief.json");
      const brief = existsSync(file) ? readJson(file) : null;
      return { issue, brief, date: brief ? parseDate(brief.date).iso : null };
    });
}

const cardList = (day, section) => section === "news" ? day?.news ?? [] : day?.[section] ? [day[section]] : [];
function planCards(plan) {
  const cards = [];
  const collect = (day, date, through, spare = false) => {
    for (const section of SECTIONS) {
      const list = spare ? day?.[section] : cardList(day, section);
      if (!Array.isArray(list)) continue;
      for (const card of list) if (isMap(card) && isText(card.id))
        cards.push({ card, topic: cardTopic(section, card, date, through), week: plan.week, spare });
    }
  };
  for (const [date, day] of Object.entries(plan.days)) if (isDate(date) && isMap(day)) collect(day, date, date);
  const monday = weekStart(plan.week);
  collect(plan.spares, monday, addDays(monday, 6), true);
  return cards;
}

function allPlans(dataDir, target) {
  const dir = join(dataDir, "plan");
  const plans = existsSync(dir) ? readdirSync(dir).filter(n => /^\d{4}-W\d{2}\.json$/.test(n) && n.slice(0, -5) !== target?.week)
    .map(n => readPlan(dataDir, n.slice(0, -5))) : [];
  return target ? [target, ...plans] : plans;
}

// 一周七天各出什么：主题和栏目，按 magazine.yaml 和调度规则现算，给主编排卡用
export function weekLayout(dataDir, week) {
  const monday = weekStart(week);
  if (!monday) throw new Error(`ISO 周看不懂：${week}（写成 YYYY-Www）`);
  const { registry, magazine } = loadSchedule(dataDir);
  const nextIssue = Math.max(0, ...issueBriefs(dataDir).map(b => Number(b.brief?.issue) || 0)) + 1;
  const names = { mon: "周一", tue: "周二", wed: "周三", thu: "周四", fri: "周五", sat: "周六", sun: "周日" };
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const { weekday, weekday_theme, sections } = schedule({ magazine, date, dataDir, issueNo: nextIssue + i, registry });
    const check = sections.check?.params;
    return { date, weekday: names[weekday] ?? weekday, theme: weekday_theme, sections: Object.keys(sections),
      check: check?.skill ? { skill: check.skill, choices: check.choices } : null };
  });
}

function loadSchedule(dataDir) {
  const { sections: registry, errors } = loadSections({ engine: ENGINE, data: dataDir });
  if (errors.length) throw new Error(`栏目注册表有问题：\n- ${errors.join("\n- ")}`);
  return { registry, magazine: loadMagazine(dataDir, registry) };
}

const ID = /^[a-z0-9-]+$/;
const timestamp = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T/.test(s) && Number.isFinite(Date.parse(s));
const textList = (v, fn) => Array.isArray(v) && v.length > 0 && v.every(fn);
function validateCard(card, section, at, errors) {
  if (!isMap(card)) { errors.push(`${at} 要是选题卡对象`); return; }
  const need = (field, ok, description) => { if (!ok) errors.push(`${at}.${field} ${description}`); };
  const text = (field, optional = false) => need(field, (optional && !Object.hasOwn(card, field)) || isText(card[field]), "要是非空字符串");
  const length = (field, max) => need(field, isText(card[field]) && stripTags(card[field]).trim() && [...stripTags(card[field])].length <= max, `要有文字且去掉标签后不超过 ${max} 字`);
  need("id", isText(card.id) && ID.test(card.id) && card.id !== "free", "要用小写字母、数字和连字符，free 是降级保留值");
  need("entities", textList(card.entities, isText), "至少要有一个实体名");
  text("why_reader");
  text("allow_repeat", true);
  if (section !== "news") need("sources", textList(card.sources, isUrl), "至少要有一个 HTTP(S) URL");
  if (section === "cover") {
    length("question", 24);
    for (const key of ["mechanism", "mechanism_key", "misconception", "answer"]) text(key);
    for (const key of ["avoid", "asked_by", "photo_hint"]) text(key, true);
    need("number", isMap(card.number) && isText(card.number.value) && isUrl(card.number.source), "要有数字说明 value 和来源 URL source");
  } else if (section === "check") {
    length("claim", 30);
    // 没有思维课表时写 真/假/说不清；有课表时写当天选项里的那一个（如「以偏概全」），run.sh 的周排清单会列出选项
    text("truth");
    text("notes", true);
  } else {
    need("url", isUrl(card.url), "要是 HTTP(S) URL");
    need("published", isDate(card.published), "要是有效的 YYYY-MM-DD 日期");
    for (const key of ["event", "title_hint", "angle"]) text(key);
    text("photo", true);
    if (Object.hasOwn(card, "followup_of")) need("followup_of", isUrl(card.followup_of), "要是旧新闻的 HTTP(S) URL");
  }
}

function validatePlan(plan, dataDir, { magazine, registry }, briefs) {
  const errors = [];
  for (const key of ["by", "curation"]) if (!isText(plan[key])) errors.push(`${key} 要是非空字符串`);
  if (!timestamp(plan.at)) errors.push("at 要是 ISO 日期时间");
  for (const [date, day] of Object.entries(plan.days)) {
    if (!isDate(date) || isoWeek(date) !== plan.week) { errors.push(`日期 ${date} 不在 ${plan.week} 内`); continue; }
    if (!isMap(day)) { errors.push(`${date} 要是对象`); continue; }
    const { sections } = schedule({ magazine, date, dataDir, issueNo: Infinity, registry });
    const ready = day.status === "ready";
    if (!ready && day.status !== "draft") errors.push(`${date}.status 要是 draft 或 ready`);
    if (!Array.isArray(day.revised) || !day.revised.every(r => isMap(r) && timestamp(r.at) && ["by", "what", "why"].every(k => isText(r[k]))))
      errors.push(`${date}.revised 要是带 at、by、what、why 的记录数组（可空）`);
    if (Object.hasOwn(day, "notes") && typeof day.notes !== "string") errors.push(`${date}.notes 要是字符串`);
    if (["week", "date", "fallback"].some(key => Object.hasOwn(day, key)))
      errors.push(`${date} 的 week、date、fallback 由任务书快照生成`);
    validateCard(day.cover, "cover", `${date}.cover`, errors);
    if (Object.hasOwn(day, "check") || (ready && sections.check)) validateCard(day.check, "check", `${date}.check`, errors);
    if (!Array.isArray(day.news)) { errors.push(`${date}.news 要是选题卡数组`); continue; }
    if (ready) {
      const [min, max] = sections.news ? newsCount(sections.news.params.layout) : [0, 0];
      if (day.news.length < min || day.news.length > max)
        errors.push(`${date}.news 要有 ${min === max ? min : `${min}–${max}`} 条，当前 ${day.news.length} 条`);
    }
    for (const [i, card] of day.news.entries()) {
      const at = `${date}.news[${i}]`;
      validateCard(card, "news", at, errors);
      if (ready && isDate(card?.published) && (card.published > date || card.published < addDays(date, -7)))
        errors.push(`${at}.published 要在出刊日前 7 天内（含出刊日）`);
    }
  }
  for (const [section, min] of [["cover", 2], ["check", 1]]) {
    const list = plan.spares?.[section];
    if (!Array.isArray(list) || list.length < min) errors.push(`spares.${section} 至少要有 ${min} 张备用卡`);
    if (Array.isArray(list)) list.forEach((card, i) => validateCard(card, section, `spares.${section}[${i}]`, errors));
  }
  for (const { issue, brief, date } of briefs) {
    if (!date || isoWeek(date) !== plan.week) continue;
    const day = plan.days[date], expected = { ...day, week: plan.week, date, status: day?.status ?? "missing" };
    const { fallback, ...actual } = brief.plan ?? { week: plan.week, date, status: "missing" };
    const locked = brief._meta?.plan_hash ?? planHash(actual);
    if (locked !== planHash(expected)) errors.push(`${date}（${issue}）已开工，不能再改`);
  }
  return errors;
}

const stable = v => Array.isArray(v) ? v.map(stable)
  : isMap(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const planHash = plan => createHash("sha256").update(JSON.stringify(stable(plan))).digest("hex");

function usedIds(brief) {
  return new Set([
    ...SECTIONS.flatMap(section => cardList(brief?.plan, section).map(c => c.id)),
    ...(brief?.plan?.fallback ?? []).flatMap(r => [r.from, r.to]),
  ].filter(id => id && id !== "free"));
}

function archivedOrigin(entry, row, briefs) {
  if (entry.topic.section !== row.section) return false;
  return briefs.some(({ brief, date }) => date === row.date && Number(brief?.issue) === row.issue && (
    entry.spare ? brief.plan?.week === entry.week && brief.plan.fallback?.some(r => r.to === row.id && r.section === row.section)
      : entry.topic.date === date && (!row.id || activeCards(brief.plan, row.section).some(card => card.id === row.id))
  ));
}

export function checkPlan(file) {
  file = resolve(file);
  const week = basename(file, ".json"), dataDir = resolve(dirname(file), "..");
  if (!file.endsWith(".json") || !weekStart(week)) throw new Error("选题文件名要是 YYYY-Www.json");
  const plan = loadPlan(file, week), config = loadSchedule(dataDir), briefs = issueBriefs(dataDir);
  const errors = validatePlan(plan, dataDir, config, briefs), warnings = [];
  if (errors.length) return { errors, warnings };

  const ctx = topicContext(dataDir, config.magazine);
  const [own, ...other] = allPlans(dataDir, plan).map(planCards);
  const external = other.flat(), entries = [...own, ...external];
  const archived = new Set(briefs.filter(({ issue }) => existsSync(join(dataDir, issue, "archive.json"))).map(b => b.date));
  const usedSpares = new Set(briefs.flatMap(({ brief }) => [...usedIds(brief)]));
  const pending = entry => entry.spare ? !usedSpares.has(entry.topic.id) : !archived.has(entry.topic.date);
  const emit = messages => messages.forEach(({ warning, text }) => (warning ? warnings : errors).push(text));
  for (const [i, entry] of own.entries()) {
    const { topic } = entry;
    if (entries.some(other => other !== entry && other.topic.id === topic.id)
      || ctx.rows.some(row => row.id === topic.id && !archivedOrigin(entry, row, briefs)))
      errors.push(`id 重复：${topic.id}`);
    if (topic.entities.length && topic.entities.every(e => ctx.generic.has(ctx.canonical(e))))
      warnings.push(`[${topic.section}] ${topic.id} 的实体全是泛称（${topic.entities.join("、")}），去重只能靠标题，请补一个具体物种、对象或事件名`);
    if (entry.spare && !pending(entry)) continue;
    for (const row of ctx.rows) {
      if (archivedOrigin(entry, row, briefs) && (row.id === topic.id || (!row.id && !entry.spare))) continue;
      if (!pending(entry) && row.date >= topic.date) continue;
      emit(compareTopics(topic, row, ctx));
    }
    if (!pending(entry)) continue;
    for (const candidate of [...own.slice(i + 1), ...external]) {
      if (!pending(candidate)) continue;
      // 同一事件的跟进由日期较晚的卡说明；同日有说明的卡作为跟进。
      const [a, b] = [topic, candidate.topic].sort((x, y) => y.date.localeCompare(x.date) || Number(!!y.followup_of) - Number(!!x.followup_of));
      // 只用较晚那张卡自己的重复理由：较早的卡一归档，较晚的卡就要单独面对总账
      emit(compareTopics(a, b, ctx, a.allow_repeat));
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

// 降级记录只影响对应栏，news 保留原卡以便看到哪一条被作废。
export function activeCards(plan, section) {
  if (!plan || plan.status === "missing") return [];
  const free = (plan.fallback ?? []).filter(r => r.section === section && r.to === "free");
  if (section === "news") return cardList(plan, section).filter(card => !free.some(r => r.from === card.id));
  return free.length ? [] : cardList(plan, section);
}

export function fallbackPlan(issueDir, section, id, reason) {
  const issue = resolve(issueDir), dataDir = resolve(issue, "../.."), file = join(issue, "brief.json");
  if (!SECTIONS.includes(section) || !isText(reason)) throw new Error("plan-fallback 需要栏目和原因，news 还需要卡 id");
  if (!existsSync(file)) throw new Error("缺少 brief.json，请先做 brief");
  if (existsSync(join(issue, "archive.json"))) throw new Error("本期已归档，不能再换卡");
  const brief = readJson(file), plan = brief.plan;
  const card = activeCards(plan, section).find(c => section !== "news" || c.id === id);
  if (!card) throw new Error(`找不到可降级的 ${section}${id ? ` 选题卡 ${id}` : " 选题卡"}`);
  const { fallback, ...original } = plan;
  let replacement;
  if (section !== "news") {
    const week = readPlan(dataDir, plan.week), ctx = topicContext(dataDir);
    const briefs = issueBriefs(dataDir);
    const used = new Set([...ctx.rows.map(row => row.id), ...briefs.flatMap(b => [...usedIds(b.brief)])]);
    const date = parseDate(brief.date).iso;
    const archived = new Set(briefs.filter(b => existsSync(join(dataDir, b.issue, "archive.json"))).map(b => b.date));
    const pending = allPlans(dataDir).flatMap(planCards)
      .filter(entry => !entry.spare && entry.topic.date !== date && !archived.has(entry.topic.date));
    const current = SECTIONS.filter(s => s !== section).flatMap(s => activeCards(plan, s).map(c => cardTopic(s, c, date)));
    replacement = (week?.spares?.[section] ?? []).find(spare => {
      const errors = [];
      validateCard(spare, section, "备用卡", errors);
      if (errors.length || used.has(spare.id)) return false;
      const topic = cardTopic(section, spare, date);
      return [...ctx.rows, ...pending.map(entry => entry.topic), ...current]
        .every(previous => compareTopics(topic, previous, ctx).every(message => message.warning));
    });
  }
  const record = { section, from: card.id, to: replacement?.id ?? "free", reason: reason.trim(), at: new Date().toISOString(), by: loadAgent(dataDir).name };
  brief._meta = { ...brief._meta, plan_hash: brief._meta?.plan_hash ?? planHash(original) };
  plan.fallback = [...(fallback ?? []), record];
  if (replacement) plan[section] = replacement;
  if (section === "cover") {
    if (replacement) brief.topic_hint = replacement.question;
    else delete brief.topic_hint;
  }
  atomicWrite(file, JSON.stringify(brief, null, 2) + "\n");
  return record;
}

const fidelity = text => stripTags(text).replace(/\s/gu, "");
export function outputTopics(brief, values, source = "archive") {
  const plan = brief.plan, date = parseDate(brief.date).iso;
  const checking = source === "check";
  const errors = [], rows = [];
  const row = (section, title, card, sources = [], actual = {}) => {
    if (!isText(title)) return;
    const topic = cardTopic(section, card ?? {}, date);
    const main = topic.url ?? sources[0] ?? null;
    // 自选稿（降级或没有选题卡）自带的主题字段 entities / mechanism_key / event 也参加去重，归档时一并进总账，
    // 这样降级出的新闻同样受实体窗口保护。有选题卡时以卡为准。
    const entities = !card && Array.isArray(actual.entities) ? actual.entities.filter(isText) : topic.entities;
    const mechanism = !card && section === "cover" && isText(actual.mechanism_key) ? actual.mechanism_key : null;
    const event = !card && section === "news" && isText(actual.event) ? actual.event : null;
    const urls = [...new Set(sources.filter(u => u !== main))];
    rows.push({
      issue: Number(brief.issue), date, section, id: card?.id ?? null, title: stripTags(title),
      entities, mechanism: topic.mechanism ?? mechanism, event: topic.event ?? event, url: main, source,
      ...(urls.length ? { urls } : {}),
      ...(checking && { allow_repeat: card?.allow_repeat, followup_of: card?.followup_of }),
    });
  };
  for (const [section, title] of [["cover", values.cover?.question?.zh], ["check", values.check?.claim]]) {
    if (!values[section]) continue;
    const [card] = activeCards(plan, section);
    const matches = card && fidelity(title) === fidelity(card.question ?? card.claim);
    if (card && !matches) errors.push(`[${section}] 稿件与选题卡 ${card.id} 的${section === "cover" ? "封面问题" : "说法"}不一致`);
    row(section, title, matches ? card : null, [], values[section]);
  }

  if (Array.isArray(values.news?.items)) {
    const items = values.news.items, cards = activeCards(plan, "news");
    const sources = items.map(item => (Array.isArray(item?.sources) ? item.sources : []).filter(isUrl));
    const keys = sources.map(urls => urls.map(urlKey));
    const assigned = new Map();
    // 增广匹配：一条稿件即便引用多张卡的来源，也只能匹配一张卡。
    const assign = (card, seen) => sources.some((urls, index) => {
      if (!keys[index].includes(urlKey(card.url)) || seen.has(index)) return false;
      seen.add(index);
      if (assigned.has(index) && !assign(assigned.get(index), seen)) return false;
      assigned.set(index, card);
      return true;
    });
    for (const card of cards) if (!assign(card, new Set())) errors.push(`[news] 找不到独立稿件引用选题卡 ${card.id} 的来源 ${card.url}`);
    const free = (plan?.fallback ?? []).filter(r => r.section === "news" && r.to === "free").length;
    if (plan?.status === "ready" && items.length > cards.length + free)
      errors.push("[news] 有未采用选题卡且未通过降级的新闻");
    items.forEach((item, i) => row("news", item?.title, assigned.get(i), sources[i], item));
  }
  return { rows, errors };
}
