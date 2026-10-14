#!/usr/bin/env node
// 流水线工具。<issue> 是一期的工作区，如 data/issues/004
//   node pipeline.mjs status   <issue>   每步做了没有，下一步能做什么
//   node pipeline.mjs check    <issue>   检查已完成步骤的字段和字数
//   node pipeline.mjs assemble <issue>   第 30 步：合并成 30-issue.json（渲染用）
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [, , cmd, issueArg] = process.argv;
if (!cmd || !issueArg) { console.error("用法: node pipeline.mjs <status|check|assemble> <issue 目录>"); process.exit(1); }
const here = dirname(fileURLToPath(import.meta.url));
const { stages } = JSON.parse(readFileSync(join(here, "..", "pipeline", "stages.json"), "utf8"));
const issue = resolve(issueArg);
const dataDir = resolve(issue, "..", "..");

const out = p => p.startsWith("issue/") ? join(issue, p.slice(6)) : join(dataDir, p.slice(5));
const done = s => s.id === "90-archive" ? false : s.outputs.every(p => {
  const f = out(p);
  return p.endsWith("/") ? existsSync(f) && statSync(f).isDirectory() : existsSync(f);
});
const read = name => JSON.parse(readFileSync(join(issue, name), "utf8"));
const has = name => existsSync(join(issue, name));

// ---------- check ----------
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;
const words = s => String(s ?? "").replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;
const problems = [];
const need = (cond, where, msg) => { if (!cond) problems.push(`[${where}] ${msg}`); };
const fields = (obj, where, keys) => keys.forEach(k => need(obj[k] !== undefined && obj[k] !== "", where, `缺少字段 ${k}`));

const checks = {
  "00-brief.json": b => {
    fields(b, "00", ["issue", "date", "weekday_theme", "masthead", "send_note", "english_level", "stamps_done", "story"]);
    need(b.story && (b.story.ep % 2 ? "zh" : "en") === b.story.lang, "00", "小剧场单数集中文、双数集英文");
  },
  "10-cover.json": c => {
    fields(c, "10", ["question", "answer", "photo", "stamp", "crew", "crew_say", "credit"]);
    need(!c.question?.options, "10", "封面只放一个问题，去掉 options（答案由今日一问讲）");
    need(len(c.question?.zh) <= 24, "10", `问题 ${len(c.question?.zh)} 字，超过 24 字`);
    need(len(c.stamp) <= 14, "10", `stamp ${len(c.stamp)} 字，超过 14 字`);
    need((c.crew ?? []).length <= 2, "10", "封面角色最多 2 个");
    need(len(c.crew_say) <= 12, "10", `crew_say ${len(c.crew_say)} 字，超过 12 字`);
    need(c.photo?.license, "10", "照片缺少协议");
  },
  "11-comic.json": c => {
    fields(c, "11", ["title_zh", "title_en", "panels", "fact"]);
    need(c.panels?.length === 4, "11", "漫画要 4 格");
    c.panels?.forEach((p, i) => p.bubbles.forEach(b => need(len(b.text) <= 30, "11", `第 ${i + 1} 格气泡 ${len(b.text)} 字，超过 30 字`)));
    need(len(c.fact) <= 60, "11", `冷知识 ${len(c.fact)} 字，超过 60 字`);
    need(!c.diagram || has(c.diagram), "11", `找不到图解 ${c.diagram}`);
  },
  "12-words.json": w => {
    fields(w, "12", ["intro", "grammar", "items", "task"]);
    need(w.items?.length === 3, "12", "单词要 3 个");
    need(w.items?.some(x => x.new), "12", "至少 1 个新词（new: true）");
    const vocab = existsSync(join(dataDir, "vocab.json")) ? JSON.parse(readFileSync(join(dataDir, "vocab.json"), "utf8")) : [];
    const self = Number(read("00-brief.json").issue ?? -1);
    w.items?.forEach(x => {
      const n = words(x.example);
      need(n >= 8 && n <= 12, "12", `${x.word} 的例句 ${n} 个词，要 8–12 个`);
      need(new RegExp(`\\b${x.word}`, "i").test(x.example), "12", `${x.word} 的例句里没出现这个词`);
      const old = vocab.find(v => v.word.toLowerCase() === x.word.toLowerCase());
      need(!old || old.issue === self, "12", `${x.word} 已经在第 ${old?.issue} 期学过`);
    });
  },
  "13-story.json": s => {
    fields(s, "13", ["ep", "lang", "title_zh", "title_en", "paragraphs", "scene", "clue", "tbc", "secret"]);
    const text = (s.paragraphs ?? []).join(" ");
    if (s.lang === "en") need(words(text) <= 110, "13", `故事 ${words(text)} 个单词，超过 110`);
    else need(len(text.replace(/\s/g, "")) <= 300, "13", `故事 ${len(text.replace(/\s/g, ""))} 字，超过 300`);
    need((s.ep % 2 ? "zh" : "en") === s.lang, "13", "单数集中文、双数集英文");
  },
  "14-puzzle.json": p => {
    fields(p, "14", ["title", "body", "answer", "solution"]);
    need(len(p.body) <= 120, "14", `题干 ${len(p.body)} 字，超过 120`);
  },
  "15-english.json": e => {
    fields(e, "15", ["taunt_zh", "taunt_en", "english", "answers"]);
    need(e.english?.length === 3, "15", "英文要 3 关");
    e.english?.forEach((x, i) => need(words(x.en) <= 45, "15", `第 ${i + 1} 关 ${words(x.en)} 个单词，超过 45`));
  },
  "16-mailbox.json": m => {
    fields(m, "16", ["letter", "ask_zh", "ask_en", "stamps_done", "reward", "send_note"]);
    need(len(m.letter) <= 130, "16", `回信 ${len(m.letter)} 字，偏长`);
  },
  "17-news.json": n => {
    fields(n, "17", ["week", "items", "ask_zh", "ask_en", "credits"]);
    need(n.items?.length === 3, "17", "新闻要 3 条");
    n.items?.forEach((x, i) => {
      need(len(x.text) <= 50, "17", `第 ${i + 1} 条 ${len(x.text)} 字，超过 50`);
      need((x.sources ?? []).length >= 2, "17", `第 ${i + 1} 条要 2 个来源`);
    });
  },
  "50-narration.json": n => {
    const EMO = ["平静", "开心", "兴奋", "惊讶", "神秘", "紧张", "困倦", "得意", "委屈", "温柔"];
    const WHO = ["narrator", "dog", "mouse", "owl", "raccoon"];
    const pages = n.narration ?? [];
    need([1, 2, 3, 4, 5, 6, 7].every(c => pages.some(p => p.card === c)), "50", "7 页都要有讲读");
    let total = 0;
    pages.forEach(p => p.lines.forEach((l, i) => {
      const at = `第 ${p.card} 页第 ${i + 1} 句`;
      need(WHO.includes(l.who), "50", `${at} who 不对：${l.who}`);
      need(["zh", "en"].includes(l.lang), "50", `${at} lang 不对：${l.lang}`);
      need(!l.emotion || EMO.includes(l.emotion), "50", `${at} emotion 不在可选范围：${l.emotion}`);
      if (l.lang === "en") need(words(l.text) <= 15, "50", `${at} ${words(l.text)} 个英文单词，超过 15`);
      else need(len(l.text) <= 40, "50", `${at} ${len(l.text)} 字，超过 40`);
      total += len(l.text) * (l.repeat || 1);
    }));
    need(total >= 2000 && total <= 4500, "50", `讲读稿共 ${total} 字，建议 2800–4000`);
  },
  "20-assets/assets.json": a => {
    [a.cover, ...(a.news ?? [])].forEach(f => need(f && has(join("20-assets", f)), "20", `找不到图片 ${f}`));
  },
};

function check() {
  for (const [file, fn] of Object.entries(checks)) {
    if (!has(file)) continue;
    try { fn(read(file)); } catch (e) { problems.push(`[${file}] 读不了：${e.message}`); }
  }
  return problems;
}

// ---------- assemble ----------
function assemble() {
  const b = read("00-brief.json"), c = read("10-cover.json"), m = read("11-comic.json"), w = read("12-words.json"),
    s = read("13-story.json"), p = read("14-puzzle.json"), e = read("15-english.json"), mb = read("16-mailbox.json"),
    a = read("20-assets/assets.json");
  const nw = has("17-news.json") ? read("17-news.json") : null;
  const asset = f => f ? `20-assets/${f}` : f;
  const strip = o => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));
  const issueJson = {
    issue: b.issue, date: b.date, weather: b.weather, masthead: b.masthead,
    question: c.question,
    cover: { photo: asset(a.cover), photo_pos: c.photo_pos, strip: c.strip, stamp: c.stamp, asked_by: c.asked_by, crew: c.crew, crew_say: c.crew_say, credit: c.credit },
    comic: { ...strip(m), theme_icon: m.theme_icon || c.theme_icon, sources: undefined },
    words: strip(w),
    story: { ep: s.ep, lang: s.lang, night: s.night, title_zh: s.title_zh, title_en: s.title_en, paragraphs: s.paragraphs, scene: s.scene, clue: s.clue, tbc: s.tbc },
    challenge: { taunt_zh: e.taunt_zh, taunt_en: e.taunt_en, prop: e.prop || "", puzzle: { title: p.title, body: p.body, slots: p.slots }, english: e.english },
    mailbox: strip(mb),
    _answers: { puzzle: p.answer, puzzle_solution: p.solution, english: e.answers, story_secret: s.secret },
  };
  if (nw) {
    issueJson.news = {
      week: nw.week, ask_zh: nw.ask_zh, ask_en: nw.ask_en, credits: nw.credits, foot: nw.foot,
      items: nw.items.map((x, i) => ({ flag: x.flag, place: x.place, title: x.title, text: x.text, word: x.word, photo: asset(a.news?.[i]), photo_pos: x.photo_pos })),
    };
    issueJson._answers.news_sources = nw.items.flatMap(x => x.sources ?? []);
  }
  writeFileSync(join(issue, "30-issue.json"), JSON.stringify(issueJson, null, 2));
  console.log(join(issue, "30-issue.json"));
}

// ---------- status ----------
function status() {
  const state = Object.fromEntries(stages.map(s => [s.id, done(s)]));
  for (const s of stages) {
    const ready = !state[s.id] && s.depends.every(d => state[d]);
    const mark = state[s.id] ? "✅" : ready ? "👉" : "⏳";
    console.log(`${mark} ${s.id.padEnd(13)} ${s.title}${s.kind === "script" ? "（脚本）" : ""}`);
  }
  const next = stages.filter(s => !state[s.id] && s.depends.every(d => state[d])).map(s => s.id);
  console.log(`\n现在可以做：${next.join("、") || "（无）"}`);
}

if (cmd === "status") status();
else if (cmd === "check") { const ps = check(); console.log(ps.length ? ps.join("\n") : "全部通过"); process.exit(ps.length ? 2 : 0); }
else if (cmd === "assemble") { const ps = check(); if (ps.length) console.warn("检查发现问题（仍然合并）：\n" + ps.join("\n")); assemble(); }
else { console.error(`不认识的命令：${cmd}`); process.exit(1); }
