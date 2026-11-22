#!/usr/bin/env node
// 只生成给家长看的纯文本，由 agent 决定怎么发。
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPipeline } from "./pipeline-lib.mjs";
import { isoWeek, planDay, readPlan } from "./plan.mjs";
import { parseDate } from "./schedule.mjs";
import { isDate, readJson, stripTags } from "./topics.mjs";

const ENGINE = new URL("../", import.meta.url);
const { stages } = readJson(fileURLToPath(new URL("pipeline/stages.json", ENGINE)));
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
const labels = { cover: "封面", check: "真的假的", news: "环球小报" };
const MAX_LINES = 25;
const line = value => stripTags(String(value ?? "").replace(/<br\s*\/?>/gi, " ")).replace(/\s+/gu, " ").trim();

function weekly(data, week) {
  const plan = readPlan(data, week);
  if (!plan) throw new Error(`找不到 plan/${week}.json`);
  const days = Object.keys(plan.days).sort().map(date => {
    const day = planDay(plan, date), weekday = weekdays[new Date(date).getUTCDay()];
    return `${date} 星期${weekday}｜${line(day.cover.question)}｜${day.check ? line(day.check.claim) : "本日没有真的假的"}`;
  });
  return [
    `📅 周选题已排好（${week}）`, ...days, "备用卡",
    ...["cover", "check"].flatMap(section => {
      const cards = (plan.spares?.[section] ?? []).map(c => line(c.question ?? c.claim));
      return cards.length ? [`${labels[section]}｜${cards.join("｜")}`] : [];
    }),
  ];
}

// 变更、降级都要告知家长，超长清单把剩余项目放进最后一行。
function fitDetails(heading, details, reserve = 0) {
  const limit = MAX_LINES - heading.length - reserve;
  if (details.length <= limit) return [...heading, ...details];
  return [...heading, ...details.slice(0, limit - 1), details.slice(limit - 1).join("；")];
}

function finalized(data, date) {
  if (!isDate(date)) throw new Error("用法：notify.mjs finalize YYYY-MM-DD");
  const day = planDay(readPlan(data, isoWeek(date)), date);
  if (day?.status !== "ready") throw new Error(`${date} 的选题还没定稿`);
  return fitDetails([
    `📝 明日选题已定稿（${date}）`, `封面｜${line(day.cover.question)}`,
    ...day.news.map(card => `新闻｜${line(card.title_hint)}`),
  ], (day.revised ?? []).map(r => `变更｜${line(r.what)}（${line(r.why)}）`));
}

function reviewHighlights(issue) {
  const file = join(issue, "review.md");
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const start = lines.findIndex(text => /^(?:#{1,6}\s+|(?:[-*]\s+)?(?:\*\*)?)值得家长看/.test(text.trim()));
  if (start < 0) return [];
  const heading = lines[start].trim().match(/^(#{1,6})\s/)?.[1].length;
  const text = lines[start].replace(/^\s*[^\p{L}]*值得家长看[^：:\n]*[：:]?/u, "").trim();
  const section = text ? [text] : [];
  for (const next of lines.slice(start + 1)) {
    if (heading === undefined ? !next.trim() || /^\s*#/.test(next) : new RegExp(`^\\s*#{1,${heading}}\\s`).test(next)) break;
    if (next.trim()) section.push(next.trim());
  }
  return section.map(text => line(text.replace(/^[-*]\s+|\*\*/g, ""))).filter(Boolean);
}

function published(issueArg) {
  const issue = resolve(issueArg), brief = readJson(join(issue, "brief.json"));
  const number = String(brief.issue).padStart(3, "0"), date = parseDate(brief.date).iso;
  if (!/^\d{3}$/.test(number) || number !== basename(issue)) throw new Error("期号要与 issues/NNN 一致");
  const pipeline = createPipeline(issue), archived = pipeline.archiveRecorded();
  const optional = new Set(["narration", "audio", "video"]);
  const missing = stages.filter(s => (!s.section || !brief.sections || Object.hasOwn(brief.sections, s.section))
    && !(["creature", "think"].includes(s.section) && !brief.sections && !brief[s.section])
    && !(["words", "english"].includes(s.section) && !brief.sections && !existsSync(join(issue, `${s.section}.json`)))
    && (!archived || optional.has(s.id)) && !pipeline.done(s.id));
  const highlights = reviewHighlights(issue);
  const main = fitDetails([
    `📰 第 ${number} 期出刊（${date}）`, `网盘｜成品/${number}/`,
    ...(missing.length ? [`未完成｜${missing.map(s => `${s.title}（${s.id}）`).join("、")}`] : []),
  ], (brief.plan?.fallback ?? []).map(r => `降级｜${labels[r.section]} ${line(r.from)} → ${r.to === "free" ? "自选" : line(r.to)}（${line(r.reason)}）`),
    highlights.length ? 3 : 0);
  return highlights.length ? [...main, "值得家长看", ...highlights] : main;
}

const [, , cmd, arg, ...extra] = process.argv;
try {
  if (!arg || extra.length || !["plan", "finalize", "issue"].includes(cmd))
    throw new Error("用法：notify.mjs plan <YYYY-Www> | finalize <YYYY-MM-DD> | issue <issues/NNN>");
  const data = process.cwd();
  const lines = cmd === "plan" ? weekly(data, arg) : cmd === "finalize" ? finalized(data, arg) : published(arg);
  console.log((lines.length <= MAX_LINES ? lines : [...lines.slice(0, MAX_LINES - 1), "……"]).join("\n"));
} catch (error) { console.error(error.message); process.exitCode = 2; }
