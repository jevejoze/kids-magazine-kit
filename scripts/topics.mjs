// 题目总账：读写记录、比较选题，以及从旧稿机械补录。
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMagazine, parseDate } from "./schedule.mjs";
import { loadSections } from "./sections.mjs";
import { localDate } from "./plan.mjs";

const ENGINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const TOPICS_FILE = "state/topics.jsonl";
export const DEDUPE = {
  news_url: true, news_event: true, news_entity_days: 21, claim: true, question: true,
  same_section_entity_days: 30, cross_section_entity_days: 14, mechanism_days: 45, title_fuzzy_days: 30,
};
const DAY = 86400e3;
export const stripTags = s => String(s ?? "").replace(/<[^>]+>/g, "");
const plain = s => stripTags(s).replace(/[\s\p{P}\p{S}]/gu, "").toLowerCase();
export const shares = (a, b, k) => {
  for (let i = 0; i + k <= a.length; i++) if (b.includes(a.slice(i, i + k))) return true;
  return false;
};
export const readJson = f => JSON.parse(readFileSync(f, "utf8"));
export const isMap = v => v !== null && typeof v === "object" && !Array.isArray(v);
export const isText = v => typeof v === "string" && v.trim() !== "";
export const isDate = v => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const date = new Date(v);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === v;
};
export const isUrl = v => {
  if (!isText(v) || !/^https?:\/\//i.test(v)) return false;
  try { return !!new URL(v).hostname; } catch { return false; }
};
const urlKey = value => {
  if (!isUrl(value)) return "";
  const url = new URL(value);
  url.hash = "";
  return url.href;
};
export const topicUrls = topic => [...new Set([topic.url, ...(topic.urls ?? [])].filter(isUrl))];

function aliases(dataDir) {
  const file = join(dataDir, "state/topic-aliases.json"), out = new Map();
  if (!existsSync(file)) return out;
  const values = readJson(file);
  if (!isMap(values)) throw new Error("state/topic-aliases.json 要写成规范名到别名数组的对象");
  for (const [name, list] of Object.entries(values)) {
    const key = plain(name);
    if (!key || !Array.isArray(list) || !list.every(v => isText(v) && plain(v)))
      throw new Error(`state/topic-aliases.json 的「${name}」要有规范名和字符串别名数组`);
    for (const v of [key, ...list.map(plain)]) {
      if (out.has(v) && out.get(v) !== key) throw new Error(`state/topic-aliases.json 的「${v}」指向多个规范名`);
      out.set(v, key);
    }
  }
  return out;
}

export function readTopics(dataDir) {
  const file = join(dataDir, TOPICS_FILE);
  if (!existsSync(file)) return [];
  const rows = [];
  for (const [i, line] of readFileSync(file, "utf8").split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (!isMap(row) || !Number.isInteger(row.issue) || !isDate(row.date) || !isText(row.section) || !isText(row.title)
        || !Array.isArray(row.entities) || !row.entities.every(isText)
        || (row.urls !== undefined && (!Array.isArray(row.urls) || !row.urls.every(isUrl))))
        throw new Error("记录需要期号、日期、栏目、标题和实体数组，urls 要是 URL 数组");
      rows.push(row);
    } catch (error) { throw new Error(`${TOPICS_FILE} 第 ${i + 1} 行有问题：${error.message}`); }
  }
  return rows;
}

export function topicContext(dataDir, magazine) {
  if (!magazine) magazine = loadMagazine(dataDir, loadSections({ engine: ENGINE, data: dataDir }).sections);
  const names = aliases(dataDir);
  return {
    rows: readTopics(dataDir),
    rules: { ...DEDUPE, ...magazine.dedupe },
    canonical: s => { const key = plain(s); return names.get(key) ?? key; },
  };
}

const bucket = row => `${row.issue}/${row.section}`;
function newRows(rows, previous) {
  const seen = new Set(previous.map(bucket));
  return rows.filter(row => !seen.has(bucket(row)));
}

// 同期同栏一组追加，新闻有多条。归档与补录都能重跑。
export function appendTopics(dataDir, rows) {
  const file = join(dataDir, TOPICS_FILE);
  const additions = newRows(rows, readTopics(dataDir));
  if (additions.length) {
    const previous = existsSync(file) ? readFileSync(file, "utf8") : "";
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, (previous && !previous.endsWith("\n") ? "\n" : "") + additions.map(row => JSON.stringify(row)).join("\n") + "\n");
  }
}

export function cardTopic(section, card, date, through = date) {
  return {
    date, through, section, id: card.id,
    title: stripTags(card.question ?? card.claim ?? card.title_hint),
    entities: card.entities ?? [], mechanism: card.mechanism_key ?? null,
    event: card.event ?? null, url: card.url ?? null,
    followup_of: card.followup_of, allow_repeat: card.allow_repeat,
  };
}

// 备用卡可在一周内任一天使用，两个日期区间取最近的距离。
function gap(a, b) {
  return Math.max(0, Date.parse(a.date) - Date.parse(b.through ?? b.date), Date.parse(b.date) - Date.parse(a.through ?? a.date)) / DAY;
}
const within = (rule, days) => rule === true || (typeof rule === "number" && days <= rule);
const similar = (a, b, n) => shares(plain(a), plain(b), n);

export function compareTopics(topic, previous, { rules, canonical }, allowRepeat = topic.allow_repeat) {
  const days = gap(topic, previous), { section } = topic;
  const sameSection = section === previous.section;
  const entities = topic.entities.map(canonical).filter(Boolean);
  const shared = previous.entities.find(entity => entities.includes(canonical(entity)));
  const messages = [];
  const add = (key, match, reason, warning = false) => {
    if (!match || !within(rules[key], days)) return;
    const explain = allowRepeat && !warning ? `（允许重复：${allowRepeat}）` : "";
    const where = previous.issue != null ? `第 ${previous.issue} 期` : previous.date;
    messages.push({
      warning: warning || !!allowRepeat,
      text: `[${section}]「${topic.title}」与 ${where} ${previous.section}「${previous.title}」${reason}${explain}`,
    });
  };
  if (sameSection && section === "news") {
    const used = new Set(topicUrls(previous).map(urlKey));
    const repeated = topicUrls(topic).find(url => used.has(urlKey(url)));
    add("news_url", repeated, `新闻 URL 重复：${repeated}`);
    add("news_event", similar(topic.event, previous.event, 10), "新闻同事件重复");
    add("news_entity_days", shared && !topic.followup_of, `新闻实体重复：${shared}`);
  }
  if (sameSection && section === "check") add("claim", similar(topic.title, previous.title, 8), "说法重复");
  if (sameSection && section === "cover") {
    add("question", similar(topic.title, previous.title, 10), "封面问题重复");
    const mechanism = canonical(topic.mechanism);
    add("mechanism_days", mechanism && mechanism === canonical(previous.mechanism), `机制重复：${previous.mechanism}`);
  }
  if (sameSection && ["cover", "check"].includes(section))
    add("same_section_entity_days", shared, `同栏目实体重复：${shared}`);
  if (!sameSection) add("cross_section_entity_days", shared, `跨栏目实体重复：${shared}`, true);
  if (sameSection) add("title_fuzzy_days", !previous.entities.length && similar(topic.title, previous.title, 6), "历史标题相似", true);
  return messages;
}

export function recentTopics({ rows, rules }, date, section, issue) {
  const recent = rows.filter(row => row.issue !== Number(issue) && row.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date) || b.issue - a.issue);
  const days = row => gap({ date }, row);
  const relevant = id => !section || section === id;
  const entityWindow = row => {
    if (section && section !== row.section) return rules.cross_section_entity_days;
    const own = row.section === "news" ? rules.news_entity_days : rules.same_section_entity_days;
    return !section && !within(own, days(row)) ? rules.cross_section_entity_days : own;
  };
  const entities = recent.filter(r => r.entities.length && within(entityWindow(r), days(r)))
    .map(r => ({ date: r.date, section: r.section, entities: r.entities }));
  const mechanisms = relevant("cover") ? recent.filter(r => r.section === "cover" && r.mechanism && within(rules.mechanism_days, days(r)))
    .map(r => ({ date: r.date, mechanism: r.mechanism })) : [];
  const titles = (id, rule) => relevant(id) ? recent.filter(r => r.section === id && within(rules[rule], days(r))).slice(0, 60)
    .map(r => ({ date: r.date, title: r.title })) : [];
  const news = relevant("news") ? recent.filter(r => r.section === "news").flatMap(r => {
    const urls = within(rules.news_url, days(r)) ? topicUrls(r) : [];
    const event = within(rules.news_event, days(r)) ? r.event : null;
    return urls.length || event ? [{ date: r.date, title: r.title, urls, event }] : [];
  }) : [];
  return { entities, mechanisms, news, claims: titles("check", "claim"), questions: titles("cover", "question") };
}

function oldIssueRows(file, no) {
  const issue = readJson(file), num = Number(issue.issue ?? no);
  if (!Number.isInteger(num)) throw new Error(`${file} 缺少期号`);
  const date = parseDate(issue.date).iso;
  const row = (section, title, urls = []) => ({
    issue: num, date, section, id: null, title: stripTags(title), entities: [], mechanism: null, event: null,
    url: urls[0] ?? null, source: "backfill", ...(urls.length > 1 ? { urls: urls.slice(1) } : {}),
  });
  const newsFile = join(dirname(file), "news.json");
  const items = issue.news?.items ?? [];
  const drafts = no && existsSync(newsFile) ? readJson(newsFile).items ?? [] : [];
  const flat = issue._answers?.news_sources ?? [];
  // 旧合并稿只有打平的来源列表。来源数能均分才按顺序拆，否则保留全栏可用来源。
  const perItem = items.length && flat.length % items.length === 0 ? flat.length / items.length : 0;
  const news = items.map((item, i) => row("news", item.title, [...new Set([
    item.url, ...(item.sources ?? drafts[i]?.sources ?? (perItem ? flat.slice(i * perItem, (i + 1) * perItem) : flat)),
  ].filter(isUrl))]));
  return [row("cover", issue.question?.zh), row("check", issue.check?.claim), ...news].filter(r => r.title);
}

function backfill(dataDir) {
  const issues = join(dataDir, "issues"), legacy = join(issues, "legacy");
  const files = existsSync(issues) ? readdirSync(issues).filter(n => /^\d{3}$/.test(n))
    .map(n => [join(issues, n, "issue.json"), n]).filter(([file]) => existsSync(file)) : [];
  if (existsSync(legacy)) for (const name of readdirSync(legacy).filter(n => n.endsWith(".json")).sort())
    files.push([join(legacy, name), name.match(/^\d{3}/)?.[0]]);
  const rows = [];
  const previous = readTopics(dataDir);
  for (const [file, number] of files) rows.push(...newRows(oldIssueRows(file, number), [...previous, ...rows]));
  return rows.sort((a, b) => a.issue - b.issue);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , cmd, arg, extra] = process.argv;
  try {
    const dataDir = process.cwd();
    if (cmd === "backfill" && (!arg || arg === "--write") && !extra) {
      const rows = backfill(dataDir);
      if (arg) appendTopics(dataDir, rows);
      for (const row of rows) console.log(JSON.stringify(row));
      if (arg) console.error(`已追加 ${rows.length} 条到 ${TOPICS_FILE}`);
    } else if (cmd === "recent" && (!arg || isDate(arg)) && !extra) {
      console.log(JSON.stringify(recentTopics(topicContext(dataDir), arg ?? localDate()), null, 2));
    } else throw new Error("用法：topics.mjs backfill [--write] | recent [YYYY-MM-DD]");
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
