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

// 渲染出来的页面顺序（card-1..N），和 template.html 一致；单词屋、新闻、连载有才出
const pageOrder = () => ["cover", "comic", has("12-words.json") && "words", "story", "challenge",
  has("17-news.json") && "news", has("18-serial.json") && "serial", "mailbox"].filter(Boolean);

// ---------- check ----------
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;
const words = s => String(s ?? "").replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;
const problems = [];
const need = (cond, where, msg) => { if (!cond) problems.push(`[${where}] ${msg}`); };
const fields = (obj, where, keys) => keys.forEach(k => need(obj[k] !== undefined && obj[k] !== "", where, `缺少字段 ${k}`));

const checks = {
  "00-brief.json": b => {
    fields(b, "00", ["issue", "date", "weekday_theme", "masthead", "send_note", "english_level", "story"]);
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
    fields(s, "13", ["ep", "title_zh", "title_en", "paragraphs", "scene", "clue", "tbc", "secret"]);
    const text = (s.paragraphs ?? []).join(" ");
    need(len(text.replace(/\s/g, "")) <= 300, "13", `故事 ${len(text.replace(/\s/g, ""))} 字，超过 300`);
  },
  "14-puzzle.json": p => {
    fields(p, "14", ["title", "body", "answer", "solution", "taunt_zh", "taunt_en"]);
    need(len(p.body) <= 120, "14", `题干 ${len(p.body)} 字，超过 120`);
  },
  "15-english.json": e => {
    fields(e, "15", ["english", "answers"]);
    need(e.english?.length === 3, "15", "英文要 3 关");
    e.english?.forEach((x, i) => need(words(x.en) <= 45, "15", `第 ${i + 1} 关 ${words(x.en)} 个单词，超过 45`));
  },
  "16-mailbox.json": m => {
    fields(m, "16", ["hello", "send_note"]);
    need(len(m.hello) <= 60, "16", `开头问候 ${len(m.hello)} 字，超过 60`);
    need(len(m.answers) <= 100, "16", `上期答案 ${len(m.answers)} 字，超过 100`);
    need(len(m.ask_zh) <= 30, "16", `本期问题 ${len(m.ask_zh)} 字，超过 30`);
  },
  "17-news.json": n => {
    fields(n, "17", ["week", "items", "ask_zh", "ask_en", "credits"]);
    need(n.items?.length === 3, "17", "新闻要 3 条");
    n.items?.forEach((x, i) => {
      need(len(x.text) <= 50, "17", `第 ${i + 1} 条 ${len(x.text)} 字，超过 50`);
      need((x.sources ?? []).length >= 2, "17", `第 ${i + 1} 条要 2 个来源`);
      fields(x.talk ?? {}, "17", ["background", "scale", "follow_up"]);
      need(x.photo_shows, "17", `第 ${i + 1} 条缺少 photo_shows（照片里实际拍到了什么）`);
    });
  },
  "18-serial.json": r => {
    const text = len((r.paragraphs ?? []).join("").replace(/\s/g, ""));
    if (r.kind === "book") {
      fields(r, "18", ["ep", "book_zh", "book_en", "chapter", "title_zh", "paragraphs", "quote", "crew", "guess", "tbc", "photo_url", "photo_credit"]);
      need(text <= 280, "18", `连载 ${text} 字，超过 280`);
      need(words(r.quote?.en) <= 25, "18", `原著金句 ${words(r.quote?.en)} 个词，超过 25`);
    } else {
      need(["music", "film", "make"].includes(r.kind), "18", `kind 要写 book、music、film 或 make：${r.kind}`);
      fields(r, "18", ["title_zh", "title_en", "by", "paragraphs", "tasks", "crew", "where", "photo_url", "photo_credit"]);
      if (r.kind === "make") {
        need(text <= 120, "18", `介绍 ${text} 字，超过 120`);
        need(r.tasks?.length >= 4 && r.tasks?.length <= 8, "18", "动手做的步骤要 4–8 步");
        r.tasks?.forEach((t, i) => need(len(t) <= 24, "18", `第 ${i + 1} 步 ${len(t)} 字，超过 24`));
      } else {
        need(text <= 180, "18", `介绍 ${text} 字，超过 180`);
        need(r.tasks?.length === 3, "18", "任务要 3 个");
      }
    }
    need(len(r.crew?.say) <= 20, "18", `crew.say ${len(r.crew?.say)} 字，超过 20`);
  },
  "50-narration.json": n => {
    const EMO = ["平静", "开心", "兴奋", "惊讶", "神秘", "紧张", "困倦", "得意", "委屈", "温柔"];
    const WHO = ["narrator", "dog", "mouse", "owl", "raccoon"];
    const pages = n.narration ?? [];
    const order = pageOrder(), cards = order.length;
    need([...Array(cards)].every((_, i) => pages.some(p => p.card === i + 1)), "50", `${cards} 页都要有讲读`);
    // 每页最多几句，按页的种类定；card 编号和渲染出来的 card-N.png 顺序一致
    const MAX = { cover: 12, comic: 26, words: 22, story: 30, challenge: 12, news: 24, serial: 20, mailbox: 10 };
    const max = c => MAX[order[c - 1]] ?? 30;
    let total = 0;
    pages.forEach(p => {
      need(p.lines.length <= max(p.card), "50", `第 ${p.card} 页（${order[p.card - 1]}）${p.lines.length} 句，最多 ${max(p.card)} 句`);
      need(p.lines.filter(l => (l.pause ?? 0) >= 3).length <= 1, "50", `第 ${p.card} 页停顿 ≥ 3 秒的地方超过 1 处`);
      let run = 0;
      p.lines.forEach((l, i) => {
        const at = `第 ${p.card} 页第 ${i + 1} 句`;
        need(WHO.includes(l.who), "50", `${at} who 不对：${l.who}`);
        need(["zh", "en"].includes(l.lang), "50", `${at} lang 不对：${l.lang}`);
        need(!l.emotion || EMO.includes(l.emotion), "50", `${at} emotion 不在可选范围：${l.emotion}`);
        if (l.lang === "en") need(words(l.text) <= 12, "50", `${at} ${words(l.text)} 个英文单词，超过 12`);
        else need(len(l.text) <= 30, "50", `${at} ${len(l.text)} 字，超过 30`);
        run = i && p.lines[i - 1].who === l.who ? run + 1 : 1;
        if (run === 4) problems.push(`[50] ${at} 起同一个角色连说超过 3 句，拆给别的角色接话`);
        total += len(l.text) * (l.repeat || 1);
      });
    });
    const [lo, hi] = [1800, 2800];
    need(total >= lo - 300 && total <= hi + 400, "50", `讲读稿共 ${total} 字，建议 ${lo}–${hi}`);
  },
  "20-assets/assets.json": a => {
    if (has("18-serial.json")) need(a.serial, "20", "assets.json 缺少连载插画 serial");
    [a.cover, ...(a.news ?? []), ...(a.serial ? [a.serial] : [])].forEach(f => need(f && has(join("20-assets", f)), "20", `找不到图片 ${f}`));
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
  const b = read("00-brief.json"), c = read("10-cover.json"), m = read("11-comic.json"),
    s = read("13-story.json"), p = read("14-puzzle.json"), mb = read("16-mailbox.json"),
    a = read("20-assets/assets.json");
  // 单词屋、英文三关是可选栏目，有文件才合并
  const w = has("12-words.json") ? read("12-words.json") : null, e = has("15-english.json") ? read("15-english.json") : {};
  const nw = has("17-news.json") ? read("17-news.json") : null;
  const asset = f => f ? `20-assets/${f}` : f;
  const strip = o => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));
  const issueJson = {
    issue: b.issue, date: b.date, weather: b.weather, masthead: b.masthead,
    question: c.question,
    cover: { photo: asset(a.cover), photo_pos: c.photo_pos, strip: c.strip, stamp: c.stamp, asked_by: c.asked_by, crew: c.crew, crew_say: c.crew_say, credit: c.credit },
    comic: { ...strip(m), theme_icon: m.theme_icon || c.theme_icon, sources: undefined },
    words: w ? strip(w) : undefined,
    story: { ep: s.ep, lang: s.lang || "zh", night: s.night, title_zh: s.title_zh, title_en: s.title_en, paragraphs: s.paragraphs, scene: s.scene, clue: s.clue, tbc: s.tbc },
    challenge: { taunt_zh: p.taunt_zh ?? e.taunt_zh, taunt_en: p.taunt_en ?? e.taunt_en, prop: p.prop ?? e.prop ?? "", puzzle: { title: p.title, body: p.body, slots: p.slots }, english: e.english },
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
  if (has("18-serial.json")) {
    const r = read("18-serial.json");
    issueJson.serial = { ...strip(r), photo: asset(a.serial), photo_url: undefined, bible_update: undefined };
  }
  writeFileSync(join(issue, "30-issue.json"), JSON.stringify(issueJson, null, 2));
  console.log(join(issue, "30-issue.json"));
}

// ---------- status ----------
function status() {
  const state = Object.fromEntries(stages.map(s => [s.id, done(s)]));
  for (const s of stages) {
    const ready = !state[s.id] && s.depends.every(d => state[d]);
    const mark = state[s.id] ? "✅" : s.optional ? "➖" : ready ? "👉" : "⏳";
    console.log(`${mark} ${s.id.padEnd(13)} ${s.title}${s.kind === "script" ? "（脚本）" : ""}${s.optional && !state[s.id] ? "（可选，默认不做）" : ""}`);
  }
  const next = stages.filter(s => !s.optional && !state[s.id] && s.depends.every(d => state[d])).map(s => s.id);
  console.log(`\n现在可以做：${next.join("、") || "（无）"}`);
}

if (cmd === "status") status();
else if (cmd === "check") { const ps = check(); console.log(ps.length ? ps.join("\n") : "全部通过"); process.exit(ps.length ? 2 : 0); }
else if (cmd === "assemble") { const ps = check(); if (ps.length) console.warn("检查发现问题（仍然合并）：\n" + ps.join("\n")); assemble(); }
else { console.error(`不认识的命令：${cmd}`); process.exit(1); }
