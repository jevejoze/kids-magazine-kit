// 英文三关的按页校验：check(english, ctx) → 问题列表（不带步骤前缀）
//   英文三关没有自己的页面，内容并进挑战页（D.challenge.english），这里只校验 15-english.json 本身
const words = s => String(s ?? "").replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;

export function check(e, ctx) {
  const problems = [], need = (ok, msg) => { if (!ok) problems.push(msg); };
  need(e.english !== undefined && e.english !== null, "缺少字段 english");
  need(e.answers !== undefined && e.answers !== null, "缺少字段 answers");
  need(e.english?.length === 3, "英文要 3 关");
  e.english?.forEach((x, i) => need(words(x.en) <= 45, `第 ${i + 1} 关 ${words(x.en)} 个单词，超过 45`));
  problems.push(...(ctx.checkProp?.(e.prop) ?? []));
  return problems;
}
