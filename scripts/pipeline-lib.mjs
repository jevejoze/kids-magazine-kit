#!/usr/bin/env node
// 流水线工具。<issue> 是一期的工作区，如 data/issues/004
//   node pipeline.mjs status   <issue>   每步做了没有，下一步能做什么
//   node pipeline.mjs check    <issue>   检查已完成步骤的字段和字数
//   node pipeline.mjs assemble <issue>   第 30 步：合并成 30-issue.json（渲染用）
//   node pipeline.mjs script   <issue>   把 50-narration.json 导出为 70-final/家长讲读稿.md
//   node pipeline.mjs archive  <issue>   第 90 步助手：追加档案、整理 成品/NNN/，打印归档回执
import { readFileSync, existsSync, statSync, mkdirSync, copyFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { contentFingerprint, inputFingerprint, recordBuild, currentBuild, atomicWrite } from "./build-state.mjs";
import {
  validateStructure,
  validateIssue,
  pageOrder as issuePageOrder,
  PAGE_KEYS,
  serialCardOf,
  cloneProfile,
  CHARS,
  PROP_HOLDERS,
  MOODS,
  PROPS,
  SPEAKERS,
  SPEAKER_NAMES,
  EMOTIONS,
  PAGE_TITLES,
  NARRATION_MAX_LINES,
} from "./contracts.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { stages } = JSON.parse(readFileSync(join(here, "..", "pipeline", "stages.json"), "utf8"));
// 50-narration.md「写法：错的和对的」里的例句，讲读稿照抄就报错
const NARRATION_EXAMPLES = (() => {
  const md = readFileSync(join(here, "..", "pipeline", "stages", "50-narration.md"), "utf8");
  return md.split("\n").filter(l => /^- [❌✅]/.test(l))
    .flatMap(l => l.replace(/^- [❌✅]\s*/, "").replace(/（[^）]*）/g, "").split("→"))
    .map(t => t.replace(/`\w+`：/, "").replace(/[\s\p{P}\p{S}A-Za-z]/gu, "")).filter(t => t.length >= 8);
})();
// 讲读里带单位的数字、年份、日期；"十几年""几亿年"这类约数不算
const NUM = "[零〇一二两三四五六七八九十百千万亿点几]";
const NUM_UNIT = new RegExp(`${NUM}{2,}(?:多)?(?:克|千克|公斤|吨|毫米|厘米|公里|千米|米|光年|毫升|升|度|倍|岁|年|天|小时|分钟|秒|万|亿|个|只|种|次|颗|条)|百分之${NUM}+`, "g");
const YEAR_DATE = new RegExp(`[零〇一二三四五六七八九]{4}年|${NUM}{1,2}月${NUM}{1,3}[日号]`);
export function createPipeline(issueArg) {
  const issue = resolve(issueArg);
  const dataDir = resolve(issue, "..", "..");

  const out = p => p.startsWith("issue/") ? join(issue, p.slice(6)) : join(dataDir, p.slice(5));
  const read = name => JSON.parse(readFileSync(join(issue, name), "utf8"));
  const has = name => existsSync(join(issue, name));
  const reviewPassed = () => has("31-review.md") && (() => {
    const md = readFileSync(join(issue, "31-review.md"), "utf8");
    return currentBuild(issue, "30-assemble") && /^结论[:：][ \t]*通过[ \t]*$/m.test(md) && !/^结论[:：][ \t]*需修改/m.test(md)
      && md.match(/^内容指纹[:：][ \t]*([a-f0-9]{64})[ \t]*$/m)?.[1] === contentFingerprint(issue);
  })();
  const nonempty = f => existsSync(f) && statSync(f).isFile() && statSync(f).size > 0;
  const done = s => {
    try {
      if (s.id === "90-archive") {
        if (!done(stages.find(s => s.id === "40-render"))) return false;
        const receipt = read("90-archive.json");
        return receipt.issue === read("00-brief.json").issue && receipt.content_hash === contentFingerprint(issue) && Array.isArray(receipt.updated) && receipt.updated.length > 0
          && receipt.updated.every(p => typeof p === "string" && nonempty(join(dataDir, p)));
      }
      if (s.id === "31-review") return reviewPassed();
      if (s.id === "40-render") {
        if (!reviewPassed() || !currentBuild(issue, s.id)) return false;
        const merged = read("30-issue.json");
        return validateIssue(merged).length === 0 && issuePageOrder(merged).every((_, i) => nonempty(join(issue, "40-cards", `card-${i + 1}.png`)))
          && nonempty(join(issue, "40-cards", `${merged.masthead.zh}-第${String(merged.issue).padStart(3, "0")}期.pdf`));
      }
      if (s.id === "60-audio") {
        if (!done(stages.find(s => s.id === "50-narration")) || !currentBuild(issue, s.id)) return false;
        const narration = read("50-narration.json");
        if (validateStructure("50-narration.json", narration).length) return false;
        const pages = narration.narration;
        const manifest = read("60-audio/manifest.json");
        // 有 voices/voicestudio.json 时，配了克隆档案的句子必须真是 VoiceStudio 合成的，不认 Azure、MiMo 的替身
        const vsFile = join(dataDir, "voices", "voicestudio.json");
        const vs = existsSync(vsFile) ? JSON.parse(readFileSync(vsFile, "utf8")) : null;
        const serialCard = vs ? serialCardOf(read("30-issue.json")) : 0;
        return pages.length > 0 && pages.every(p => p.lines.length > 0 && p.lines.every((line, i) => {
          const file = `c${p.card}_${String(i).padStart(2, "0")}.wav`;
          const entry = manifest.files?.find(f => f.file === file && f.card === p.card && f.index === i);
          const profile = vs && cloneProfile(vs, line, p.card, serialCard);
          return entry && nonempty(join(issue, "60-audio", file)) && (!profile || entry.by === `VoiceStudio-${profile}`);
        }));
      }
      if (s.id === "70-video") {
        if (!["40-render", "60-audio"].every(id => done(stages.find(s => s.id === id))) || !currentBuild(issue, s.id)) return false;
        const merged = read("30-issue.json");
        return nonempty(join(issue, "70-final/讲读版.mp4"))
          && nonempty(join(issue, "70-final", `${merged.masthead.zh}-第${String(merged.issue).padStart(3, "0")}期.pdf`));
      }
      return s.outputs.every(p => {
        const f = out(p);
        if (!nonempty(f)) return false;
        if (!p.endsWith(".json")) return true;
        const name = p.slice(6), value = read(name);
        if (validateStructure(name, value).length) return false;
        const before = problems.length;
        checks[name]?.(value);
        const valid = problems.length === before;
        problems.splice(before);
        return valid && (name !== "30-issue.json" || (validateIssue(value).length === 0 && currentBuild(issue, "30-assemble")));
      });
    } catch { return false; }
  };
  // 有 when 的步骤（如 09-creature 只在周一出、08-think 只在周五出）：任务书里这个字段不为 true 就算本期不出
  const skipped = s => {
    try { return !!(s.when && has("00-brief.json") && read("00-brief.json")[s.when] === false); }
    catch { return false; }
  };
  const useCreature = () => has("09-creature.json") && (!has("00-brief.json") || !!read("00-brief.json").creature);
  const useThink = () => has("08-think.json") && (!has("00-brief.json") || !!read("00-brief.json").think);

  // 渲染出来的页面顺序（card-1..N），和 template.html 一致；怪物档案、单词屋、新闻、真的假的、连载、周末思辨有才出
  const pageOrder = () => issuePageOrder({ cover: {}, comic: {}, creature: useCreature() ? {} : undefined,
    words: has("12-words.json") ? {} : undefined, story: {}, challenge: {}, news: has("17-news.json") ? {} : undefined,
    check: has("19-check.json") ? {} : undefined, serial: has("18-serial.json") ? {} : undefined,
    think: useThink() ? {} : undefined, mailbox: {} });

  // ---------- check ----------
  const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;
  const plain = s => String(s ?? "").replace(/<[^>]+>/g, "").replace(/[\s\p{P}\p{S}]/gu, "");
  const shares = (a, b, k) => { for (let i = 0; i + k <= a.length; i++) if (b.includes(a.slice(i, i + k))) return true; return false; };
  const words = s => String(s ?? "").replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;
  const problems = [];
  const need = (cond, where, msg) => { if (!cond) problems.push(`[${where}] ${msg}`); };
  const fields = (obj, where, keys) => keys.forEach(k => need(obj[k] !== undefined && obj[k] !== null && obj[k] !== "", where, `缺少字段 ${k}`));
  const checkProp = (p, where, at = "prop") => p && String(p).split("+").filter(Boolean).forEach(k => need(PROPS.includes(k), where, `${at} 道具不存在：${k}`));
  const checkChar = (spec, where, at = "角色") => {
    const [n, m = "normal", s = "180", p = ""] = String(spec ?? "").split(":");
    need(CHARS.includes(n), where, `${at} 名字不对：${spec}`);
    need(MOODS.includes(m), where, `${at} 表情不对：${spec}`);
    need(Number(s) > 0, where, `${at} 尺寸不对：${spec}`);
    if (p) {
      need(PROP_HOLDERS.includes(n), where, `${at} 不支持戴道具：${spec}`);
      checkProp(p, where, `${at} (${spec})`);
    }
  };

  const META_SPOILER = /思维本领|思维方法|今天学|今天练|本周练/;

  const checks = {
    "00-brief.json": b => {
      fields(b, "00", ["issue", "date", "weekday_theme", "masthead", "send_note", "english_level", "story"]);
      const prevIssue = join(issue, "..", String(Number(b.issue) - 1).padStart(3, "0"), "30-issue.json");
      if (existsSync(prevIssue)) {
        try {
          const prev = JSON.parse(readFileSync(prevIssue, "utf8"));
          need(b.story?.ep === (prev.story?.ep ?? 0) + 1, "00", `小剧场集数 ep=${b.story?.ep} 与上期 ep=${prev.story?.ep} 不连续`);
        } catch {}
      }
    },
    "08-think.json": t => {
      fields(t, "08", ["title", "story", "sides", "role", "deeper", "parent_guide", "source", "log_update"]);
      need(len(t.title) <= 18, "08", `话题 ${len(t.title)} 字，超过 18`);
      need(len(t.story) <= 120, "08", `故事 ${len(t.story)} 字，超过 120`);
      need(t.sides?.length === 2, "08", "sides 要 2 个成员，各站一边");
      t.sides?.forEach((x, i) => {
        checkChar(x.who, "08", `第 ${i + 1} 个观点角色`);
        need(len(x.say) <= 36, "08", `第 ${i + 1} 个观点 ${len(x.say)} 字，超过 36`);
      });
      need(len(t.role) <= 40, "08", `角色代入 ${len(t.role)} 字，超过 40`);
      need(t.deeper?.length === 2, "08", "deeper 要 2 个追问");
      t.deeper?.forEach((x, i) => need(len(x) <= 30, "08", `第 ${i + 1} 个追问 ${len(x)} 字，超过 30`));
      need(!t.photo_url || t.photo_credit, "08", "有配图就写 photo_credit");
      need(!META_SPOILER.test([t.title, t.story, ...(t.sides ?? []).map(s => s.say), t.role, ...(t.deeper ?? [])].join(" ")), "08", "周末思辨正文不得点破「思维本领/今天练」等课表字眼");
    },
    "09-creature.json": r => {
      fields(r, "09", ["no", "name_zh", "parts", "legend_url", "legend_credit", "photo_url", "photo_credit", "stats", "meters", "boxes", "fast", "slow", "sources", "log_update"]);
      need(len(r.name_zh) <= 8, "09", `名字 ${len(r.name_zh)} 字，超过 8`);
      need(r.stats?.length === 3, "09", "stats 要 3 格");
      need(r.meters?.length >= 2 && r.meters?.length <= 3, "09", "meters 要 2–3 条");
      r.meters?.forEach(m => need(m.n >= 1 && m.n <= 5, "09", `${m.label} 的格数要 1–5：${m.n}`));
      need(r.boxes?.length === 3, "09", "boxes 要 3 块：传说里说、科学家怎么说、真实原型");
      r.boxes?.forEach((x, i) => need(len(x.text) <= 60, "09", `第 ${i + 1} 块 ${len(x.text)} 字，超过 60`));
      need(len(r.fast) <= 24 && len(r.slow) <= 24, "09", "快脑袋、慢脑袋各 ≤ 24 字");
      need((r.sources ?? []).length >= 2, "09", "要 2 个来源");
    },
    "10-cover.json": c => {
      fields(c, "10", ["question", "answer", "photo", "stamp", "crew", "crew_say", "credit"]);
      need(!c.question?.options, "10", "封面只放一个问题，去掉 options（答案由今日一问讲）");
      need(len(c.question?.zh) <= 24, "10", `问题 ${len(c.question?.zh)} 字，超过 24 字`);
      need(len(c.stamp) <= 14, "10", `stamp ${len(c.stamp)} 字，超过 14 字`);
      need((c.crew ?? []).length <= 2, "10", "封面角色最多 2 个");
      (c.crew ?? []).forEach((x, i) => checkChar(x, "10", `封面第 ${i + 1} 个角色`));
      need(len(c.crew_say) <= 12, "10", `crew_say ${len(c.crew_say)} 字，超过 12 字`);
      need(c.photo?.license, "10", "照片缺少协议");
    },
    "11-comic.json": c => {
      fields(c, "11", ["title_zh", "title_en", "panels", "fact"]);
      need(c.panels?.length === 4, "11", "漫画要 4 格");
      c.panels?.forEach((p, i) => {
        need(p.bubbles.length <= 2, "11", `第 ${i + 1} 格气泡 ${p.bubbles.length} 个，最多 2 个`);
        (p.chars ?? []).forEach(x => checkChar(x, "11", `第 ${i + 1} 格角色`));
      });
      const diagPath = c.diagram ? join(issue, c.diagram) : "";
      need(c.diagram && nonempty(diagPath), "11", `找不到非空图解 ${c.diagram}`);
      if (c.diagram && nonempty(diagPath) && String(c.diagram).endsWith(".svg")) {
        const svg = readFileSync(diagPath, "utf8");
        need(/<svg\b[^>]*\bviewBox=["']0 0 880 300["']/.test(svg), "11", "图解 SVG 必须设置 viewBox=\"0 0 880 300\"");
        need(!/<image\b[^>]*\b(?:href|xlink:href)=["']https?:/i.test(svg), "11", "图解 SVG 不可引用外部网络图片");
        const small = [...svg.matchAll(/font-size=["']?(\d+(?:\.\d+)?)/g)].map(m => Number(m[1])).find(sz => sz < 20);
        need(!small, "11", `图解 SVG 含过小字号 ${small}px（要求中文标注 ≥ 24 号字）`);
      }
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
      (s.scene ?? []).forEach((x, i) => checkChar(x, "13", `scene[${i}]`));
    },
    "14-puzzle.json": p => {
      const e = has("15-english.json") ? read("15-english.json") : {};
      fields({ ...e, ...p }, "14", ["title", "body", "answer", "solution", "taunt_zh"]);
      need(len(p.body) <= 120, "14", `题干 ${len(p.body)} 字，超过 120`);
      need(len([p.body, ...(p.clues ?? []), p.question ?? ""].join("")) <= 240, "14", "题目情境、条件和问题合计超过 240 字");
      if (p.taunt_zh) need(len(p.taunt_zh) <= 20, "14", `taunt_zh ${len(p.taunt_zh)} 字，超过 20`);
      if (p.taunt_en) need(words(p.taunt_en) <= 10, "14", `taunt_en ${words(p.taunt_en)} 个单词，超过 10`);
      checkProp(p.prop, "14");
    },
    "15-english.json": e => {
      fields(e, "15", ["english", "answers"]);
      need(e.english?.length === 3, "15", "英文要 3 关");
      e.english?.forEach((x, i) => need(words(x.en) <= 45, "15", `第 ${i + 1} 关 ${words(x.en)} 个单词，超过 45`));
      checkProp(e.prop, "15");
    },
    "16-mailbox.json": m => {
      fields(m, "16", ["hello", "send_note"]);
      need(len(m.hello) <= 60, "16", `开头问候 ${len(m.hello)} 字，超过 60`);
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
        const origami = r.kind === "make" && r.craft === "origami";
        // 折纸用完整图式代替成品照片
        fields(r, "18", ["title_zh", "title_en", "by", "paragraphs", "tasks", "crew", "where", ...(origami ? ["diagram_url", "diagram_credit", "diagram_steps"] : ["photo_url", "photo_credit"])]);
        if (r.kind === "make") {
          need(["origami", "3d"].includes(r.craft), "18", `动手做的 craft 要写 origami 或 3d：${r.craft}`);
          need(text <= (origami ? 30 : 120), "18", `介绍 ${text} 字，超过 ${origami ? 30 : 120}`);
          if (origami) {
            need(r.diagram_steps <= 12, "18", `图式 ${r.diagram_steps} 步，超过 12`);
            need(r.tasks?.length === r.diagram_steps, "18", `每一步图配一句话：图式 ${r.diagram_steps} 步，tasks ${r.tasks?.length} 句`);
            r.tasks?.forEach((t, i) => need(len(t) <= 14, "18", `第 ${i + 1} 步 ${len(t)} 字，超过 14`));
          } else {
            need(r.tasks?.length >= 4 && r.tasks?.length <= 8, "18", "3D 打印的步骤要 4–8 步");
            r.tasks?.forEach((t, i) => need(len(t) <= 24, "18", `第 ${i + 1} 步 ${len(t)} 字，超过 24`));
          }
        } else {
          need(text <= 180, "18", `介绍 ${text} 字，超过 180`);
          need(r.tasks?.length === 3, "18", "任务要 3 个");
        }
      }
      if (r.crew?.who) checkChar(r.crew.who, "18", "crew.who");
      need(len(r.crew?.say) <= 20, "18", `crew.say ${len(r.crew?.say)} 字，超过 20`);
    },
    "19-check.json": k => {
      fields(k, "19", ["where", "claim", "clues", "verdict", "explain", "sources"]);
      need(len(k.claim) <= 30, "19", `说法 ${len(k.claim)} 字，超过 30`);
      need(k.clues?.length === 3, "19", "线索要 3 条");
      k.clues?.forEach((c, i) => need(len(c) <= 36, "19", `第 ${i + 1} 条线索 ${len(c)} 字，超过 36`));
      if (k.choices) {
        need(k.choices.length >= 2 && k.choices.length <= 3 && k.choices.every(c => len(c) <= 8), "19", "choices 要 2–3 个，每个 ≤ 8 字（含表情）");
        need(k.choices.includes(k.answer), "19", `answer 要是 choices 里的一个：${k.answer}`);
      } else need(["true", "false", "half"].includes(k.truth), "19", `truth 要写 true、false 或 half：${k.truth}`);
      need(!k.skill || len(k.skill) <= 10, "19", `skill ${len(k.skill)} 字，超过 10`);
      need(!k.tools || (k.tools.length === 3 && k.tools.every(t => t.length === 2)), "19", "tools 要 3 个 [标题, 小字]");
      need(len(k.verdict) <= 40, "19", `倒印答案 ${len(k.verdict)} 字，超过 40`);
      need((k.sources ?? []).length >= 2, "19", "要 2 个来源");
      need(!k.photo_url || k.photo_credit, "19", "有配图就写 photo_credit");
      need(!META_SPOILER.test([k.claim, ...(k.clues ?? []), k.verdict].join(" ")), "19", "真的假的正文与答案不得点破「思维本领/今天练」等课表字眼");
    },
    "50-narration.json": n => {
      need(reviewPassed() && n._meta?.content_hash === contentFingerprint(issue), "50", "讲读稿未绑定当前已审稿内容，请重写并记录 _meta.content_hash");
      const pages = n.narration ?? [];
      const hasStages = has("10-cover.json") || has("30-issue.json");
      // 渲染过就按 40-cards/pages.json 对页：它记着每张图是哪个栏目（注册的新栏目也在里面）
      const pagesFile = join(issue, "40-cards", "pages.json");
      const rendered = existsSync(pagesFile) ? JSON.parse(readFileSync(pagesFile, "utf8")).map(p => p.section) : null;
      if (rendered) need(JSON.stringify(rendered.filter(k => PAGE_KEYS.includes(k))) === JSON.stringify(pageOrder()), "40", "40-cards/pages.json 的页序和本期栏目对不上，请重新渲染");
      const order = rendered ?? pageOrder(), cards = order.length;
      if (hasStages) need(pages.length === cards && pages.every((p, i) => p.card === i + 1), "50", `${cards} 页都要按顺序讲读，不可重复或遗漏`);
      // 每页最多几句，按页的种类定；card 编号和渲染出来的 card-N.png 顺序一致（有英文三关时挑战页多 6 句）
      const MAX = { ...NARRATION_MAX_LINES, challenge: has("15-english.json") ? 18 : NARRATION_MAX_LINES.challenge };
      const max = c => (hasStages ? MAX[order[c - 1]] : undefined) ?? 30;
      let total = 0;
      // 照页面念的检查：各页的叙述文字（引号里的角色对白不算）
      const unquote = t => String(t ?? "").replace(/“[^”]*”|"[^"]*"/g, "");
      const src = k => has(k) ? read(k) : {};
      const pageText = {
        comic: [src("11-comic.json").fact, src("11-comic.json").takeaway, src("11-comic.json").diagram_title],
        creature: (src("09-creature.json").boxes ?? []).map(b => b.text),
        story: (src("13-story.json").paragraphs ?? []).map(unquote),
        news: (src("17-news.json").items ?? []).map(i => i.text),
        serial: (src("18-serial.json").paragraphs ?? []).map(unquote),
        think: [src("08-think.json").story],
      };
      const ROLE_NAMES = { dog: /团子狗/, mouse: /波波鼠/, owl: /咕咕博士/, raccoon: /捣蛋浣熊|浣熊/ };
      const OPENER_CLICHE = /看完|讲完|做完|听完|查完|弄懂|明白了|完了|合上/;
      const DOG_TRANSLATION = /[A-Za-z]{3,}\s*(?:[，,：:]\s*(?:就是|是)?|就是|意思是?|指(?:的是)?|是(?!什么|啥|哪))\s*[\u4e00-\u9fa5]/;
      let all = 0, narr = 0, zh = 0, calm = 0, cliche = 0, waitCount = 0;
      const FAMILY = /爸爸|妈妈|爷爷|奶奶|外公|外婆|姥姥|姥爷|哥哥|姐姐|家人/g;
      const sendTo = String(src("16-mailbox.json").send_note ?? "").match(FAMILY) ?? [];
      const storyTbc = plain(src("13-story.json").tbc);
      const newsWords = (src("17-news.json").items ?? []).map(i => i.word?.en).filter(Boolean);
      const serialSrc = src("18-serial.json");
      const serialCrew = serialSrc.kind === "book" ? String(serialSrc.crew?.who ?? "").split(":")[0] || null : null;
      pages.forEach(p => {
        const kind = order[p.card - 1];
        need(p.thread && len(p.thread) <= 30, "50", `第 ${p.card} 页缺 thread（这一页的主线，≤ 30 字），先定主线再写台词`);
        need(p.lines.length <= max(p.card), "50", `第 ${p.card} 页（${kind}）${p.lines.length} 句，最多 ${max(p.card)} 句`);
        if (kind !== "serial") {
          const nn = p.lines.filter(l => l.who === "narrator").length;
          all += p.lines.length; narr += nn;
          need(nn <= p.lines.length * 0.6, "50", `第 ${p.card} 页旁白 ${nn}/${p.lines.length} 句，超过六成；对白交给角色说，旁白只串词、交代场景`);
        }
        if (p.card > 1 && p.lines[0] && OPENER_CLICHE.test(p.lines[0].text)) cliche++;
        if (kind === "challenge") need(!p.lines.some(l => /答案.*(明天|下一期|信箱)|(明天|信箱).*答案/.test(l.text)), "50", `第 ${p.card} 页挑战的答案倒印在本页底部，不说"明天 / 信箱公布答案"`);
        const plains = p.lines.map(l => l.lang === "zh" ? plain(l.text) : "");
        for (let i = 0; i < plains.length; i++) for (let j = i + 1; j < plains.length; j++)
          if (shares(plains[i], plains[j], 8)) problems.push(`[50] 第 ${p.card} 页第 ${i + 1}、${j + 1} 句说了同一件事（连续 8 字相同），只留一处`);
        const srcs = (pageText[kind] ?? []).filter(Boolean).map(plain);
        if (srcs.length) {
          const copied = p.lines.filter((l, i) => l.lang === "zh" && !l.pause && srcs.some(t => shares(plains[i], t, 10)));
          const limit = Math.max(2, Math.floor(p.lines.length / 4));
          need(copied.length <= limit, "50", `第 ${p.card} 页有 ${copied.length} 句照着页面念（连续 10 字相同），最多 ${limit} 句，换成口语、拆给角色接：${copied.map(l => l.text).slice(0, 3).join(" / ")}`);
        }
        need(p.lines.filter(l => (l.pause ?? 0) >= 3).length <= 1, "50", `第 ${p.card} 页停顿 ≥ 3 秒的地方超过 1 处`);
        const zhText = p.lines.filter(l => l.lang === "zh").map(l => l.text);
        if (!["story", "challenge", "serial"].includes(kind)) {
          const nums = new Set(zhText.flatMap(t => t.match(NUM_UNIT) ?? []).filter(m => !m.includes("几")));
          const cap = kind === "news" ? 3 : 1;
          need(nums.size <= cap, "50", `第 ${p.card} 页有 ${nums.size} 个数字（${[...nums].join("、")}），${kind === "news" ? "每条新闻" : "一页"}只留主线那一个，配一个摸得着的比较`);
        }
        if (kind !== "challenge") zhText.filter(t => YEAR_DATE.test(t)).forEach(t => problems.push(`[50] 第 ${p.card} 页念了年份或日期，删掉或改成"十几年前""上个星期"：${t}`));
        const copiedEx = zhText.filter(t => NARRATION_EXAMPLES.some(e => shares(plain(t), e, 8)));
        need(!copiedEx.length, "50", `第 ${p.card} 页照抄了 50-narration.md 的例句，例句只示范结构，用本期内容重新造句：${copiedEx.join(" / ")}`);
        if (kind === "news") newsWords.forEach(w => need(p.lines.some(l => l.lang === "en" && new RegExp(`\\b${w}`, "i").test(l.text)), "50", `第 ${p.card} 页没讲到关键词 ${w} 那条新闻；三条新闻的关键词都由波波鼠放进英文短句里说`));
        if (kind === "comic") {
          const at = p.lines.findIndex(l => /试试|试一试/.test(l.text));
          need(at < 0 || at >= p.lines.length - 2, "50", `第 ${p.card} 页"试试"后面还有 ${p.lines.length - 1 - at} 句，"你也可以试试"放在最后`);
        }
        if (kind === "mailbox") {
          zhText.forEach(t => [...t.matchAll(/(?:说给|讲给|发给|告诉|拿给)(爸爸|妈妈|爷爷|奶奶|外公|外婆|姥姥|姥爷|哥哥|姐姐|家人)/g)]
            .forEach(m => need(!sendTo.length || sendTo.includes(m[1]), "50", `第 ${p.card} 页说"${m[0]}"，send_note 写的是"${src("16-mailbox.json").send_note}"`)));
          if (storyTbc) zhText.filter(t => shares(plain(t), storyTbc, 5)).forEach(t => problems.push(`[50] 第 ${p.card} 页的预告重复了小剧场的 tbc，换一个新悬念：${t}`));
        }
        // 英文走完一个来回：波波鼠的英文句后 3 句内，有人用中文接住时把原词带上
        if (["comic", "creature", "news"].includes(kind)) p.lines.forEach((l, i) => {
          if (l.who !== "mouse" || l.lang !== "en") return;
          const ws = (l.text.match(/[A-Za-z]{4,}/g) ?? []).map(w => w.toLowerCase());
          const named = n => (n.text.match(/[A-Za-z]{3,}/g) ?? []).some(t => ws.some(w => w.startsWith(t.toLowerCase()) || t.toLowerCase().startsWith(w)));
          need(p.lines.slice(i + 1, i + 4).some(n => n.lang === "zh" && n.who !== "mouse" && named(n)), "50",
            `第 ${p.card} 页第 ${i + 1} 句英文没走完来回：波波鼠说出英文短句后，后 3 句内要有同伴自然接住，带上核心英文词结合语境回应（如"对，volcano 火山要喷发啦！"）：${l.text}`);
        });
        // 先交代再提起：角色问的事，后面旁白才交代
        p.lines.forEach((l, i) => {
          if (l.who === "narrator" || l.lang !== "zh" || !/[？?]/.test(l.text)) return;
          const later = p.lines.slice(i + 1).find(n => n.who === "narrator" && n.lang === "zh" && !/[？?]/.test(n.text) && shares(plain(l.text), plain(n.text), 4));
          if (later) problems.push(`[50] 第 ${p.card} 页第 ${i + 1} 句先问了旁白后面才交代的事，把交代挪到前面：${l.text} → ${later.text}`);
        });
        if (kind === "serial" && serialCrew) need(p.lines.some(l => l.who === serialCrew), "50", `第 ${p.card} 页认领角色的吐槽（crew.say）由 ${serialCrew} 自己说，旁白只用一句引出`);
        if (kind === "mailbox") zhText.filter(t => /你猜/.test(t)).forEach(t => problems.push(`[50] 第 ${p.card} 页信箱不再出猜谜题，只念 ask_zh 和打卡问题：${t}`));
        let run = 0;
        const noEmo = [];
        p.lines.forEach((l, i) => {
          const at = `第 ${p.card} 页第 ${i + 1} 句`;
          if (order[p.card - 1] === "mailbox") need(!/上期答案|上期.*谜题.*答案/.test(l.text), "50", `${at} 信箱不再公布上期答案`);
          need(SPEAKERS.includes(l.who), "50", `${at} who 不对：${l.who}`);
          need(["zh", "en"].includes(l.lang), "50", `${at} lang 不对：${l.lang}`);
          need(!l.emotion || EMOTIONS.includes(l.emotion), "50", `${at} emotion 不在可选范围：${l.emotion}`);
          if (ROLE_NAMES[l.who]) need(!ROLE_NAMES[l.who].test(l.text.replace(/我是\S{2,4}[，,！!。]?/, "")), "50", `${at} 角色说了自己的名字，叙述交给旁白：${l.text}`);
          if (l.lang === "en") {
            need(words(l.text) <= 12, "50", `${at} ${words(l.text)} 个英文单词，超过 12`);
            if (kind === "news") need(words(l.text) >= 3, "50", `${at} 英文只有单词，放进一句 3–8 个词的短句里说：${l.text}`);
          }
          else {
            zh++;
            if (!l.emotion) noEmo.push(i + 1);
            if (l.emotion === "平静") calm++;
            need(len(l.text) <= 30, "50", `${at} ${len(l.text)} 字，超过 30`);
            need(!/[0-9%]/.test(l.text), "50", `${at} 中文台词含阿拉伯数字或 %，请写成中文读法（如"十八点五"、"百分之七"）：${l.text}`);
            need(!META_SPOILER.test(l.text), "50", `${at} 讲读台词不得点破「思维本领/今天练」等课表字眼：${l.text}`);
            if (l.who === "dog" && DOG_TRANSLATION.test(l.text))
              problems.push(`[50] ${at} 团子狗台词解释了英文词（${l.text}）；团子狗不懂英文，只负责学舌或好奇发问，释义由咕咕博士解释`);
          }
          if (l.text.includes("等等")) waitCount++;
          run = i && p.lines[i - 1].who === l.who ? run + 1 : 1;
          // 连载页按 serial-bible 可以全由旁白一个人念
          if (run === 4 && !(kind === "serial" && l.who === "narrator")) problems.push(`[50] ${at} 起同一个角色连说超过 3 句，拆给别的角色接话`);
          total += len(l.text) * (l.repeat || 1);
        });
        need(!noEmo.length, "50", `第 ${p.card} 页第 ${noEmo.join("、")} 句是中文却没写 emotion`);
      });
      need(narr <= all * 0.4, "50", `旁白占 ${narr}/${all} 句（连载页除外），超过四成；叙述归旁白，说话归角色`);
      need(calm <= zh * 0.4, "50", `"平静"语气 ${calm}/${zh} 句，超过四成；按台词换成惊讶、得意、神秘等`);
      need(cliche <= 2, "50", `${cliche} 页用"看完了 / 讲完了"这类收尾式串词开场，最多 2 处；接住上一页的一个具体细节`);
      need(waitCount <= 1, "50", `全期"等等"出现 ${waitCount} 次（最多 1 次），换成"咦？""慢着！""不对呀！"等生动口吻`);
      const [lo, hi] = [1800, 2800];
      need(total >= lo - 300 && total <= hi + 400, "50", `讲读稿共 ${total} 字，建议 ${lo}–${hi}`);
    },
    "20-assets/assets.json": a => {
      need(a.news?.length === 3, "20", "assets.json 的 news 要有 3 张图片");
      if (has("18-serial.json")) {
        const r = read("18-serial.json");
        if (r.craft === "origami") {
          need(a.serial, "20", "assets.json 缺少折纸完成图 serial（真实拍的成品照片）");
          need(a.serial_steps || a.serial_diagram, "20", "assets.json 缺少折纸图式：serial_steps（一步一张）或 serial_diagram（整张）");
          need(!a.serial_steps || a.serial_steps.length === r.diagram_steps, "20", `serial_steps ${a.serial_steps?.length} 张，图式 ${r.diagram_steps} 步`);
        }
        else need(a.serial, "20", "assets.json 缺少连载插画 serial");
      }
      need(!useCreature() || a.creature, "20", "assets.json 缺少怪物卡照片 creature");
      need(!useCreature() || a.creature_legend, "20", "assets.json 缺少怪物卡传说图 creature_legend");
      need(!useThink() || !read("08-think.json").photo_url || a.think, "20", "assets.json 缺少周末思辨配图 think");
      need(!has("19-check.json") || !read("19-check.json").photo_url || a.check, "20", "assets.json 缺少真的假的配图 check");
      [a.cover, ...(a.news ?? []), ...[a.creature, a.creature_legend, a.check, a.think, a.serial, a.serial_diagram, ...(a.serial_steps ?? [])].filter(Boolean)].forEach(f => need(f && nonempty(join(issue, "20-assets", f)), "20", `找不到非空图片 ${f}`));
    },
  };

  function check({ contentOnly = false } = {}) {
    problems.length = 0;
    for (const [file, fn] of Object.entries(checks)) {
      if (!has(file) || (contentOnly && file === "50-narration.json")) continue;
      if (file === "08-think.json" && !useThink()) continue;
      if (file === "09-creature.json" && !useCreature()) continue;
      try {
        const value = read(file), structural = validateStructure(file, value);
        problems.push(...structural);
        if (!structural.length) fn(value);
      } catch (e) { problems.push(`[${file}] 读不了：${e.message}`); }
    }
    if (!contentOnly && has("31-review.md")) need(reviewPassed(), "31", "审稿未通过或内容指纹已过期，请重新合并、审稿");
    return problems;
  }

  // ---------- assemble ----------
  function assemblyErrors() {
    const errors = [...check({ contentOnly: true })];
    const target = stages.find(s => s.id === "30-assemble");
    for (const id of target.depends) {
      const stage = stages.find(s => s.id === id);
      if (!skipped(stage) && !done(stage)) errors.push(`[${id}] 合并所需步骤未完成或输出无效`);
    }
    return errors;
  }
  // 只按源稿拼出整期 JSON，不校验、不写文件；回归比对也用它
  function buildIssue() {
    const b = read("00-brief.json"), c = read("10-cover.json"), m = read("11-comic.json"),
      s = read("13-story.json"), p = read("14-puzzle.json"), mb = read("16-mailbox.json"),
      a = read("20-assets/assets.json");
    // 单词屋、英文三关是可选栏目，有文件才合并
    const w = has("12-words.json") ? read("12-words.json") : null, e = has("15-english.json") ? read("15-english.json") : {};
    const nw = has("17-news.json") ? read("17-news.json") : null;
    const cr = useCreature() ? read("09-creature.json") : null, ck = has("19-check.json") ? read("19-check.json") : null;
    const th = useThink() ? read("08-think.json") : null;
    const asset = f => f ? `20-assets/${f}` : f;
    const strip = o => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));
    const issueJson = {
      issue: b.issue, date: b.date, weather: b.weather, masthead: b.masthead, character_pack: b.character_pack,
      question: c.question,
      cover: { photo: asset(a.cover), photo_pos: c.photo_pos, strip: c.strip, stamp: c.stamp, asked_by: c.asked_by, crew: c.crew, crew_say: c.crew_say, credit: c.credit },
      comic: { ...strip(m), theme_icon: m.theme_icon || c.theme_icon, sources: undefined },
      creature: cr ? { ...strip(cr), photo: asset(a.creature), credit: cr.photo_credit, legend: asset(a.creature_legend), legend_url: undefined, photo_url: undefined, photo_credit: undefined, sources: undefined, log_update: undefined } : undefined,
      words: w ? strip(w) : undefined,
      story: { ep: s.ep, lang: s.lang || "zh", night: s.night, title_zh: s.title_zh, title_en: s.title_en, paragraphs: s.paragraphs, scene: s.scene, clue: s.clue, tbc: s.tbc },
      challenge: { taunt_zh: p.taunt_zh ?? e.taunt_zh, taunt_en: p.taunt_en ?? e.taunt_en, prop: p.prop ?? e.prop ?? "", puzzle: { title: p.title, body: p.body, clues: p.clues, question: p.question }, english: e.english },
      check: ck ? { where: ck.where, claim: ck.claim, likes: ck.likes, comments: ck.comments, photo: asset(a.check), photo_pos: ck.photo_pos, credit: ck.photo_credit, clues: ck.clues, verdict: ck.verdict, choices: ck.choices, tools: ck.tools } : undefined,
      think: th ? { title: th.title, title_en: th.title_en, story: th.story, photo: asset(a.think), photo_pos: th.photo_pos, credit: th.photo_credit, sides: th.sides, role: th.role, deeper: th.deeper } : undefined,
      mailbox: { ...strip(mb), answers: undefined },
      _answers: { puzzle: p.answer, puzzle_solution: p.solution, english: e.answers, story_secret: s.secret, check: ck ? { skill: ck.skill, truth: ck.truth ?? ck.answer, verdict: ck.verdict, explain: ck.explain, sources: ck.sources } : undefined, creature_sources: cr?.sources, think_guide: th?.parent_guide, think_source: th?.source },
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
      issueJson.serial = { ...strip(r), photo: asset(a.serial), diagram: asset(a.serial_diagram), steps: a.serial_steps?.map(asset), photo_url: undefined, diagram_url: undefined, bible_update: undefined };
    }
    return issueJson;
  }
  function assemble() {
    const errors = assemblyErrors();
    const inputs = inputFingerprint(issue, "30-assemble");
    if (errors.length) throw new Error(errors.join("\n"));
    const issueJson = buildIssue();
    const structural = validateIssue(issueJson);
    if (structural.length) throw new Error(structural.join("\n"));
    atomicWrite(join(issue, "30-issue.json"), JSON.stringify(issueJson, null, 2));
    recordBuild(issue, "30-assemble", inputs, [join(issue, "30-issue.json")]);
    console.log(join(issue, "30-issue.json"));
  }

  // ---------- status ----------
  function status() {
    const state = Object.fromEntries(stages.map(s => [s.id, done(s) || skipped(s)]));
    for (const s of stages) {
      const ready = !state[s.id] && s.depends.every(d => state[d]);
      const outdated = !state[s.id] && s.outputs.some(p => existsSync(out(p)));
      const mark = skipped(s) ? "➖" : state[s.id] ? "✅" : s.optional ? "➖" : ready ? "👉" : "⏳";
      console.log(`${mark} ${s.id.padEnd(13)} ${s.title}${s.kind === "script" ? "（脚本）" : ""}${skipped(s) ? "（本期不出）" : s.optional && !state[s.id] ? "（可选，默认不做）" : outdated ? "（未完成、输出无效或已过期）" : ""}`);
    }
    const next = stages.filter(s => !s.optional && !state[s.id] && s.depends.every(d => state[d])).map(s => s.id);
    console.log(`\n现在可以做：${next.join("、") || "（无）"}`);
  }

  // ---------- script (家长讲读稿导出) ----------
  function script(outArg) {
    if (!has("50-narration.json")) throw new Error("缺少 50-narration.json");
    const n = read("50-narration.json");
    const b = has("00-brief.json") ? read("00-brief.json") : (has("30-issue.json") ? read("30-issue.json") : {});
    const order = pageOrder();
    const lines = [
      `# ${b.masthead?.zh || "每日杂志"} · 第 ${String(b.issue ?? "").padStart(3, "0")} 期 家长讲读稿`,
      "",
      `> 日期：${b.date || ""}　｜　按页照着念即可，括号内为语气和停顿提示。`,
      "",
    ];
    for (const p of n.narration ?? []) {
      const key = order[p.card - 1];
      const title = PAGE_TITLES[key] || key || "";
      lines.push(`## 第 ${p.card} 页 · ${title}`);
      lines.push("");
      for (const l of p.lines ?? []) {
        const who = SPEAKER_NAMES[l.who] || l.who;
        const tags = [];
        if (l.emotion && l.emotion !== "平静") tags.push(l.emotion);
        if (l.rate === "slow") tags.push("慢速");
        if (l.sfx) tags.push(`音效:${l.sfx}`);
        const prefix = tags.length ? `（${tags.join("·")}）` : "";
        const suffix = l.pause ? ` *(停 ${l.pause} 秒${l.hold ? ` · ${l.hold}` : ""})*` : "";
        lines.push(`- **${who}**${prefix}：${l.text}${suffix}`);
      }
      lines.push("");
    }
    const finalDir = join(issue, "70-final");
    mkdirSync(finalDir, { recursive: true });
    const outPath = outArg ? resolve(outArg) : join(finalDir, "家长讲读稿.md");
    atomicWrite(outPath, lines.join("\n"));
    console.log(outPath);
    return outPath;
  }

  // ---------- archive (第 90 步助手) ----------
  // 只做本地能自动完成的部分；"未回收伏笔"、profile.md 和网盘核对仍由 agent 做，核对完再写 90-archive.json
  function archive() {
    if (!done(stages.find(s => s.id === "40-render"))) throw new Error("页图未完成、审稿未通过或已过期，请先完成第 40 步再归档");
    const b = read("00-brief.json");
    const num = Number(b.issue);
    const padNum = String(num).padStart(3, "0");
    const updated = [];

    if (has("12-words.json")) {
      const vocabPath = join(dataDir, "vocab.json");
      const vocab = existsSync(vocabPath) ? JSON.parse(readFileSync(vocabPath, "utf8")) : [];
      let changed = false;
      for (const item of read("12-words.json").items ?? []) {
        if (!vocab.some(v => v.word.toLowerCase() === item.word.toLowerCase())) {
          vocab.push({ word: item.word, cn: item.cn, issue: num });
          changed = true;
        }
      }
      if (changed) atomicWrite(vocabPath, JSON.stringify(vocab, null, 2) + "\n");
      if (vocab.some(v => v.issue === num)) updated.push("vocab.json");
    }

    // 只追加；marker 已在文件里就视为追加过
    const appendSection = (relName, marker, text) => {
      if (!text || !String(text).trim()) return;
      const p = join(dataDir, relName);
      const cur = existsSync(p) ? readFileSync(p, "utf8") : `# ${relName}\n`;
      if (!cur.includes(marker) && !cur.includes(String(text).trim())) atomicWrite(p, cur.replace(/\s*$/, "\n\n") + String(text).trim() + "\n");
      updated.push(relName);
    };
    if (has("13-story.json")) {
      const s = read("13-story.json");
      const marker = `EP.${String(s.ep).padStart(2, "0")}`;
      const entry = s.bible_update
        ? (String(s.bible_update).includes(marker) ? s.bible_update : `### ${marker}（第 ${padNum} 期）\n${s.bible_update}`)
        : `### ${marker}《${s.title_zh}》（第 ${padNum} 期）\n- 真相：${s.secret || ""}`;
      appendSection("story-bible.md", marker, entry);
    }
    if (has("18-serial.json")) {
      const r = read("18-serial.json");
      if (r.bible_update) appendSection("serial-bible.md", `第 ${padNum} 期`, `- 第 ${padNum} 期（${b.date}）：${r.bible_update}`);
    }
    if (useCreature()) {
      const cr = read("09-creature.json");
      if (cr.log_update) appendSection("creature-log.md", `No.${cr.no}`, `- No.${cr.no}（第 ${padNum} 期）：${cr.log_update}`);
    }
    if (useThink()) {
      const th = read("08-think.json");
      if (th.log_update) appendSection("think-log.md", `第 ${padNum} 期`, `- 第 ${padNum} 期（${b.date}）：${th.log_update}`);
    }

    // 成品/NNN/：文件名照 pipeline/README.md「目录」；讲读版只在第 70 步有效时复制
    const merged = read("30-issue.json");
    const pdf = `${merged.masthead.zh}-第${padNum}期.pdf`;
    const pubDir = join(dataDir, "成品", padNum), cardsDir = join(issue, "40-cards");
    mkdirSync(pubDir, { recursive: true });
    for (const f of readdirSync(pubDir)) if (/^card-\d+\.png$/.test(f)) rmSync(join(pubDir, f));
    issuePageOrder(merged).forEach((_, i) => copyFileSync(join(cardsDir, `card-${i + 1}.png`), join(pubDir, `card-${i + 1}.png`)));
    copyFileSync(join(cardsDir, pdf), join(pubDir, pdf));
    const video = done(stages.find(s => s.id === "70-video"));
    if (video) copyFileSync(join(issue, "70-final", "讲读版.mp4"), join(pubDir, `${merged.masthead.zh}-第${padNum}期-讲读版.mp4`));

    const receipt = { issue: num, content_hash: contentFingerprint(issue), updated: [...new Set(updated)] };
    console.log(`成品已整理到 ${pubDir}${video ? "" : "（讲读版未完成或已过期，没有复制）"}`);
    console.log(`核对网盘、更新"未回收伏笔"后，把下面这行写进 90-archive.json：\n${JSON.stringify(receipt)}`);
    return receipt;
  }

  return { status, check, assemble, buildIssue, script, archive, assemblyErrors, reviewPassed, fingerprint: () => contentFingerprint(issue), done: id => done(stages.find(s => s.id === id)) };
}
