// Shared structural contracts and domain constants. Editorial checks remain in pipeline-lib.mjs.
export const PAGE_KEYS = ["cover", "comic", "creature", "words", "story", "challenge", "news", "check", "serial", "think", "mailbox"];
export const CARD_IDS = { cover: "c1", comic: "c2", creature: "cdeep", words: "c3", story: "c4", challenge: "c5", news: "cnews", check: "ccheck", serial: "cserial", think: "cthink", mailbox: "c6" };
export const PAGE_TITLES = { cover: "封面", comic: "今日一问", creature: "传说怪物档案", words: "单词屋", story: "小剧场", challenge: "挑战", news: "环球小报", check: "真的假的", serial: "经典连载", think: "周末思辨", mailbox: "信箱" };
export const NARRATION_MAX_LINES = { cover: 12, comic: 26, creature: 14, words: 22, story: 30, challenge: 12, news: 24, check: 12, serial: 20, think: 14, mailbox: 10 };
export const CHARS = ["dog", "mouse", "owl", "raccoon", "box", "dogbox"];
export const PROP_HOLDERS = ["dog", "mouse", "owl", "raccoon"];
export const MOODS = ["normal", "happy", "wave", "smirk", "sleepy", "angry", "surprise", "talk", "think", "peek"];
export const PROPS = ["sunglasses", "eyemask", "partyhat", "scarf", "magnifier", "sweat"];
export const SPEAKERS = ["narrator", "dog", "mouse", "owl", "raccoon"];
export const SPEAKER_NAMES = { narrator: "🎙 旁白", dog: "🐶 团子狗", mouse: "🐭 波波鼠", owl: "🦉 咕咕博士", raccoon: "🦝 捣蛋浣熊" };
export const EMOTIONS = ["平静", "开心", "兴奋", "惊讶", "神秘", "紧张", "困倦", "得意", "委屈", "温柔"];
export const pageOrder = issue => PAGE_KEYS.filter(key => issue[key] != null);

// Paths with [] validate every array item, as well as the array itself.
const contracts = {
  "00-brief.json": { issue: "number", date: "string", "masthead.zh": "string", "masthead.en": "string", "story.ep": "number" },
  "08-think.json": { title: "string", story: "string", "sides[].who": "string", "sides[].say": "string", "deeper[]": "string" },
  "09-creature.json": { name_zh: "string", "parts[]": "object", "stats[]": "object", "meters[].n": "number", "boxes[].text": "string" },
  "10-cover.json": { "question.zh": "string", "question.en": "string", "photo.license": "string", "crew[]": "string" },
  "11-comic.json": { title_zh: "string", title_en: "string", "panels[].bubbles[].text": "string", "panels[].chars[]": "string", fact: "string" },
  "12-words.json": { "items[].word": "string", "items[].example": "string" },
  "13-story.json": { ep: "number", "paragraphs[]": "string", "scene[]": "string", clue: "string" },
  "14-puzzle.json": { title: "string", body: "string", solution: "string" },
  "15-english.json": { "english[].en": "string" },
  "16-mailbox.json": { hello: "string", send_note: "string" },
  "17-news.json": { "items[].title": "string", "items[].text": "string", "items[].word.en": "string", "items[].word.zh": "string", "items[].sources[]": "string", "items[].talk.background": "string", "items[].talk.scale": "string", "items[].talk.follow_up": "string", "items[].photo_shows": "string" },
  "18-serial.json": { kind: "string", "paragraphs[]": "string", "crew.who": "string", "crew.say": "string" },
  "19-check.json": { claim: "string", "clues[]": "string", "sources[]": "string", verdict: "string" },
  "20-assets/assets.json": { cover: "string", "news[]": "string" },
  "50-narration.json": { "narration[].card": "number", "narration[].lines[].who": "string", "narration[].lines[].lang": "string", "narration[].lines[].text": "string" },
};

export function validateStructure(file, value, omit = []) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return [`[${file}] 顶层必须是对象`];
  for (const [path, type] of Object.entries(contracts[file] ?? {})) {
    if (omit.includes(path)) continue;
    const visit = (node, segments, at) => {
      if (!segments.length) {
        const valid = type === "object" ? node && typeof node === "object" && !Array.isArray(node)
          : typeof node === type && (type !== "string" || node.trim().length > 0) && (type !== "number" || Number.isFinite(node));
        if (!valid) errors.push(`[${file}] ${at} 必须是非空 ${type}`);
        return;
      }
      const [part, ...rest] = segments, many = part.endsWith("[]"), key = many ? part.slice(0, -2) : part;
      const child = node?.[key], next = at ? `${at}.${key}` : key;
      if (many) {
        if (!Array.isArray(child) || !child.length) errors.push(`[${file}] ${next} 必须是非空数组`);
        else child.forEach((item, i) => visit(item, rest, `${next}[${i}]`));
      } else visit(child, rest, next);
    };
    visit(value, path.split("."), "");
  }
  return [...new Set(errors)];
}

export function validateIssue(issue) {
  const errors = [];
  if (!issue || typeof issue !== "object" || Array.isArray(issue)) return ["整期必须是对象"];
  for (const key of ["cover", "comic", "story", "challenge", "mailbox"]) {
    if (!issue[key] || typeof issue[key] !== "object" || Array.isArray(issue[key])) errors.push(`整期缺少 ${key}`);
  }
  if (!Number.isInteger(issue.issue) || issue.issue < 1) errors.push("期号必须是正整数");
  if (typeof issue.masthead?.zh !== "string" || !issue.masthead.zh.trim()) errors.push("整期缺少 masthead.zh");
  if (typeof issue.question?.zh !== "string" || !issue.question.zh.trim()) errors.push("整期缺少 question.zh");
  const sections = { creature: "09-creature.json", think: "08-think.json", check: "19-check.json", comic: "11-comic.json", words: "12-words.json", story: "13-story.json", news: "17-news.json", serial: "18-serial.json", mailbox: "16-mailbox.json" };
  // Sources and narration-only news fields are intentionally omitted from assembled data.
  for (const [key, file] of Object.entries(sections)) {
    if (!issue[key]) continue;
    const omit = key === "news" ? ["items[].sources[]", "items[].photo_shows", "items[].talk.background", "items[].talk.scale", "items[].talk.follow_up"] : key === "check" ? ["sources[]"] : [];
    errors.push(...validateStructure(file, issue[key], omit));
  }
  if (!issue.challenge?.puzzle || typeof issue.challenge.puzzle.title !== "string" || typeof issue.challenge.puzzle.body !== "string") errors.push("整期缺少 challenge.puzzle 的标题或题干");
  return errors;
}
