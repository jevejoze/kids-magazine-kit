// 经典连载 · 书的按页校验：check(serial, ctx) → 问题列表（不带步骤前缀）
//   kind、crew 这些各 kind 共用的检查在 pipeline-lib 里，这里只管书
const REQUIRED = ["ep", "book_zh", "book_en", "chapter", "title_zh", "paragraphs", "quote", "crew", "guess", "tbc", "photo_url", "photo_credit"];
const MAX_CHARS = 280, MAX_QUOTE_WORDS = 25, MAX_CREW_SAY = 20;
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;
const words = s => String(s ?? "").replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;

export function check(r, ctx = {}) {
  const problems = [];
  for (const k of REQUIRED) if (r[k] === undefined || r[k] === null || r[k] === "") problems.push(`缺少字段 ${k}`);

  if (Array.isArray(r.paragraphs)) {
    if (r.paragraphs.length < 2 || r.paragraphs.length > 4) problems.push("连载正文段落须在 2–4 段之间");
    const n = len(r.paragraphs.join("").replace(/\s/g, ""));
    if (n > MAX_CHARS) problems.push(`连载 ${n} 字，超过 ${MAX_CHARS}`);
  }

  if (r.quote) {
    if (!r.quote.en || !r.quote.zh) problems.push("原著金句缺少 en 或 zh");
    if (words(r.quote.en) > MAX_QUOTE_WORDS) problems.push(`原著金句 ${words(r.quote.en)} 个词，超过 ${MAX_QUOTE_WORDS}`);
  }

  if (r.crew) {
    if (r.crew.say && len(r.crew.say) > MAX_CREW_SAY) problems.push(`认领角色吐槽 ${len(r.crew.say)} 字，超过 ${MAX_CREW_SAY}`);
    if (r.crew.who && ctx.checkChar) problems.push(...(ctx.checkChar(r.crew.who, "crew.who") ?? []));
  }

  if (r.guess && !/[？?]$/.test(r.guess.trim())) {
    problems.push("悬念/辩论发问（guess）须以问号结尾");
  }

  return problems;
}

// 这一页的讲读校验：checkNarration(lines, ctx) → 问题列表
//   规矩 16：连载吐槽由认领的成员自己说，旁白只用一句引出
//   ctx.crewWho：认领这个书中角色的编辑部成员（取自 serial.json 的 crew.who，形如 "dog:happy:150"）
export function checkNarration(lines, ctx = {}) {
  const problems = [];
  if (lines.length > 0 && lines.every(l => l.who === "narrator")) return problems;
  const who = String(ctx.crewWho ?? "").split(":")[0];
  if (who && !lines.some(l => l.who === who)) problems.push("认领角色的吐槽（crew.say）由该角色自己说，旁白只用一句引出");
  return problems;
}
