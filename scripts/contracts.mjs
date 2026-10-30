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
export const COMIC_LIMITS = Object.freeze({ solo: 26, pair: 20, takeaway: 28, fact: 45, character: 130 });
export const EMOTIONS = ["平静", "开心", "兴奋", "惊讶", "神秘", "紧张", "困倦", "得意", "委屈", "温柔"];
// issue._order（调度按 magazine.yaml 的 sections 顺序算出来）存在就按它排，不然退回旧的固定页序
export const pageOrder = issue => Array.isArray(issue._order) ? issue._order.filter(key => issue[key] != null) : PAGE_KEYS.filter(key => issue[key] != null);
// 经典连载（读书）页在渲染顺序里是第几张；周五的音乐盒、放映室、动手做不算，返回 0
export const serialCardOf = issue => issue.serial && (issue.serial.kind ?? "book") === "book" ? pageOrder(issue).indexOf("serial") + 1 : 0;
// voices/voicestudio.json 里这句该用哪个克隆档案：键是 角色/语言，加 @serial 只用于连载页；不用克隆返回 undefined
export const cloneProfile = (conf, line, card, serialCard) => (card === serialCard && conf[`${line.who}/${line.lang}@serial`]) || conf[`${line.who}/${line.lang}`];

// Paths with [] validate every array item, as well as the array itself.
const contracts = {
  "brief.json": { issue: "number", date: "string", "masthead.zh": "string", "masthead.en": "string", "story.ep": "number" },
  "think.json": { title: "string", story: "string", "sides[].who": "string", "sides[].say": "string", "deeper[]": "string" },
  "creature.json": { name_zh: "string", "parts[]": "object", "stats[]": "object", "meters[].n": "number", "boxes[].text": "string" },
  "cover.json": { "question.zh": "string", "question.en": "string", "photo.license": "string", "crew[]": "string" },
  "comic.json": { title_zh: "string", title_en: "string", "panels[].bubbles[].text": "string", "panels[].chars[]": "string", fact: "string" },
  "words.json": { "items[].word": "string", "items[].example": "string" },
  "story.json": { ep: "number", "paragraphs[]": "string", "scene[]": "string", clue: "string" },
  "challenge.json": { title: "string", body: "string", answer: "string", solution: "string" },
  "english.json": { "english[].en": "string" },
  "mailbox.json": { hello: "string" },
  "news.json": { "items[].title": "string", "items[].text": "string", "items[].word.en": "string", "items[].word.zh": "string", "items[].sources[]": "string", "items[].talk.background": "string", "items[].talk.scale": "string", "items[].talk.follow_up": "string", "items[].photo_shows": "string" },
  "serial.json": { kind: "string", "paragraphs[]": "string", "crew.who": "string", "crew.say": "string" },
  "check.json": { claim: "string", "clues[]": "string", "sources[]": "string", verdict: "string" },
  "assets/assets.json": { cover: "string", "news[]": "string" },
  "narration.json": { "narration[].card": "number", "narration[].lines[].who": "string", "narration[].lines[].lang": "string", "narration[].lines[].text": "string" },
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
  if (file === "comic.json") {
    errors.push(...validateComicContent(value).map(error => `[${file}] ${error}`));
    for (const key of ["diagram_title", "takeaway", "fact_title"]) {
      if (value[key] !== undefined && (typeof value[key] !== "string" || !value[key].trim())) errors.push(`[${file}] ${key} 必须是非空 string`);
    }
    if (Array.isArray(value.panels)) value.panels.forEach((panel, i) => {
      if (panel?.title !== undefined && (typeof panel.title !== "string" || !panel.title.trim())) errors.push(`[${file}] panels[${i}].title 必须是非空 string`);
    });
  }
  if (file === "challenge.json") errors.push(...validatePuzzleLayout(value));
  return [...new Set(errors)];
}

export function validateIssue(issue) {
  const errors = [];
  if (!issue || typeof issue !== "object" || Array.isArray(issue)) return ["整期必须是对象"];
  // 旧版杂志固定这五页都有；有 _order（按 magazine.yaml 的 sections 排的）时，只要求这期真的选了的那几栏
  const required = Array.isArray(issue._order) ? ["cover", "comic", "story", "challenge", "mailbox"].filter(k => issue._order.includes(k)) : ["cover", "comic", "story", "challenge", "mailbox"];
  for (const key of required) {
    if (!issue[key] || typeof issue[key] !== "object" || Array.isArray(issue[key])) errors.push(`整期缺少 ${key}`);
  }
  if (!Number.isInteger(issue.issue) || issue.issue < 1) errors.push("期号必须是正整数");
  if (typeof issue.masthead?.zh !== "string" || !issue.masthead.zh.trim()) errors.push("整期缺少 masthead.zh");
  if (typeof issue.question?.zh !== "string" || !issue.question.zh.trim()) errors.push("整期缺少 question.zh");
  const sections = { creature: "creature.json", think: "think.json", check: "check.json", comic: "comic.json", words: "words.json", story: "story.json", news: "news.json", serial: "serial.json", mailbox: "mailbox.json" };
  // Sources and narration-only news fields are intentionally omitted from assembled data.
  for (const [key, file] of Object.entries(sections)) {
    if (!issue[key]) continue;
    const omit = key === "news" ? ["items[].sources[]", "items[].photo_shows", "items[].talk.background", "items[].talk.scale", "items[].talk.follow_up"] : key === "check" ? ["sources[]"] : [];
    errors.push(...validateStructure(file, issue[key], omit));
  }
  const hasChallenge = !Array.isArray(issue._order) || issue._order.includes("challenge");
  if (hasChallenge && (!issue.challenge?.puzzle || typeof issue.challenge.puzzle.title !== "string" || typeof issue.challenge.puzzle.body !== "string")) errors.push("整期缺少 challenge.puzzle 的标题或题干");
  if (issue.challenge?.puzzle) errors.push(...validatePuzzleLayout(issue.challenge.puzzle));
  if (hasChallenge && (typeof issue._answers?.puzzle !== "string" || !issue._answers.puzzle.trim())) errors.push("整期缺少本页倒印的谜题答案 _answers.puzzle");
  if (issue.challenge?.english?.length && (!Array.isArray(issue._answers?.english) || issue._answers.english.length !== issue.challenge.english.length || issue._answers.english.some(a => typeof a !== "string" || !a.trim()))) errors.push("英文三关必须有逐关对应的本页答案 _answers.english");
  return errors;
}

function validatePuzzleLayout(puzzle) {
  if (puzzle.clues === undefined && puzzle.question === undefined) return [];
  const errors = [];
  if (!Array.isArray(puzzle.clues) || !puzzle.clues.length || puzzle.clues.some(c => typeof c !== "string" || !c.trim())) errors.push("谜题 clues 必须是非空字符串数组，每条条件单独写");
  if (typeof puzzle.question !== "string" || !puzzle.question.trim()) errors.push("谜题 question 必须明确说明要求解的问题");
  return errors;
}


// Comic copy is plain text. Count exactly what the template displays, including < and >.
export function validateComicContent(comic) {
  const errors = [];
  const count = text => [...String(text ?? "")].length;
  for (const [key, max] of [["diagram_title", 28], ["takeaway", COMIC_LIMITS.takeaway], ["fact", COMIC_LIMITS.fact], ["fact_title", 8]]) {
    if (typeof comic[key] === "string" && count(comic[key]) > max) errors.push(`${key} ${count(comic[key])} 字，最多 ${max} 字`);
  }
  if (Array.isArray(comic.panels)) comic.panels.forEach((panel, i) => {
    if (!panel || typeof panel !== "object") return;
    if (count(panel.title) > 12) errors.push(`第 ${i + 1} 格小标题最多 12 字`);
    const chars = Array.isArray(panel.chars) ? panel.chars : [];
    const bubbles = Array.isArray(panel.bubbles) ? panel.bubbles : [];
    const max = bubbles.length > 1 || chars.length > 1 ? COMIC_LIMITS.pair : COMIC_LIMITS.solo;
    bubbles.forEach((bubble, j) => {
      if (typeof bubble?.text !== "string") return;
      if (/<\/?[a-z][^>]*>/i.test(bubble.text)) errors.push(`第 ${i + 1} 格第 ${j + 1} 个气泡必须是纯文本，不能使用 HTML 标签`);
      if (count(bubble.text) > max) errors.push(`第 ${i + 1} 格第 ${j + 1} 个气泡 ${count(bubble.text)} 字，最多 ${max} 字`);
    });
    const specs = [...chars, ...bubbles.map(b => b?.who).filter(who => typeof who === "string" && who.includes(":"))];
    specs.forEach(spec => {
      const size = Number(String(spec).split(":")[2] ?? "110");
      if (!Number.isFinite(size) || size <= 0 || size > COMIC_LIMITS.character) errors.push(`第 ${i + 1} 格角色尺寸必须在 1–${COMIC_LIMITS.character}px：${spec}`);
    });
  });
  return errors;
}
