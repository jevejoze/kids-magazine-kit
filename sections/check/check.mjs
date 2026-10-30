// 真的假的的按页校验：check(check, ctx) → 问题列表（不带步骤前缀）
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;
const META_SPOILER = /思维本领|思维方法|今天学|今天练|本周练/;

export function check(k, ctx) {
  const problems = [], need = (ok, msg) => { if (!ok) problems.push(msg); };
  const fields = (obj, keys) => keys.forEach(key => need(obj[key] !== undefined && obj[key] !== null && obj[key] !== "", `缺少字段 ${key}`));
  fields(k, ["where", "claim", "clues", "verdict", "explain", "sources"]);
  need(len(k.claim) <= 30, `说法 ${len(k.claim)} 字，超过 30`);
  need(k.clues?.length === 3, "线索要 3 条");
  k.clues?.forEach((c, i) => need(len(c) <= 36, `第 ${i + 1} 条线索 ${len(c)} 字，超过 36`));
  if (k.choices) {
    need(k.choices.length >= 2 && k.choices.length <= 3 && k.choices.every(c => len(c) <= 8), "choices 要 2–3 个，每个 ≤ 8 字（含表情）");
    need(k.choices.includes(k.answer), `answer 要是 choices 里的一个：${k.answer}`);
  } else need(["true", "false", "half"].includes(k.truth), `truth 要写 true、false 或 half：${k.truth}`);
  need(!k.skill || len(k.skill) <= 10, `skill ${len(k.skill)} 字，超过 10`);
  need(!k.tools || (k.tools.length === 3 && k.tools.every(t => t.length === 2)), "tools 要 3 个 [标题, 小字]");
  need(len(k.verdict) <= 40, `倒印答案 ${len(k.verdict)} 字，超过 40`);
  need((k.sources ?? []).length >= 2, "要 2 个来源");
  need(!k.photo_url || k.photo_credit, "有配图就写 photo_credit");
  need(!META_SPOILER.test([k.claim, ...(k.clues ?? []), k.verdict].join(" ")), "真的假的正文与答案不得点破「思维本领/今天练」等课表字眼");
  return problems;
}
