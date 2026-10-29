// 经典连载 · 书的按页校验：check(serial, ctx) → 问题列表（不带步骤前缀）
//   kind、crew 这些各 kind 共用的检查在 pipeline-lib 里，这里只管书
const REQUIRED = ["ep", "book_zh", "book_en", "chapter", "title_zh", "paragraphs", "quote", "crew", "guess", "tbc", "photo_url", "photo_credit"];
const MAX_CHARS = 280, MAX_QUOTE_WORDS = 25;
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;
const words = s => String(s ?? "").replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;

export function check(r) {
  const problems = [];
  for (const k of REQUIRED) if (r[k] === undefined || r[k] === null || r[k] === "") problems.push(`缺少字段 ${k}`);
  const n = len((r.paragraphs ?? []).join("").replace(/\s/g, ""));
  if (n > MAX_CHARS) problems.push(`连载 ${n} 字，超过 ${MAX_CHARS}`);
  if (words(r.quote?.en) > MAX_QUOTE_WORDS) problems.push(`原著金句 ${words(r.quote?.en)} 个词，超过 ${MAX_QUOTE_WORDS}`);
  return problems;
}
