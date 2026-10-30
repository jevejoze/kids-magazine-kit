// 挑战的按页校验：check(challenge, ctx) → 问题列表（不带步骤前缀）
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;
const words = s => String(s ?? "").replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;

export function check(p, ctx) {
  const problems = [], need = (ok, msg) => { if (!ok) problems.push(msg); };
  const fields = (obj, keys) => keys.forEach(k => need(obj[k] !== undefined && obj[k] !== null && obj[k] !== "", `缺少字段 ${k}`));
  const e = ctx.english ?? {};
  fields({ ...e, ...p }, ["title", "body", "answer", "solution", "taunt_zh"]);
  need(len(p.body) <= 120, `题干 ${len(p.body)} 字，超过 120`);
  need(len([p.body, ...(p.clues ?? []), p.question ?? ""].join("")) <= 240, "题目情境、条件和问题合计超过 240 字");
  if (p.taunt_zh) need(len(p.taunt_zh) <= 20, `taunt_zh ${len(p.taunt_zh)} 字，超过 20`);
  if (p.taunt_en) need(words(p.taunt_en) <= 10, `taunt_en ${words(p.taunt_en)} 个单词，超过 10`);
  problems.push(...(ctx.checkProp?.(p.prop) ?? []));
  return problems;
}
