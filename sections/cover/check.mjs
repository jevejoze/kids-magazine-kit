// 封面的按页校验：check(cover, ctx) → 问题列表（不带步骤前缀）
//   ctx.checkChar(spec, at) → 角色写法的问题列表
const REQUIRED = ["question", "answer", "photo", "stamp", "crew", "crew_say", "credit"];
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;

export function check(c, ctx = {}) {
  const problems = [];
  for (const k of REQUIRED) if (c[k] === undefined || c[k] === null || c[k] === "") problems.push(`缺少字段 ${k}`);
  if (c.question?.options) problems.push("封面只放一个问题，去掉 options（答案由今日一问讲）");
  if (len(c.question?.zh) > 24) problems.push(`问题 ${len(c.question?.zh)} 字，超过 24 字`);
  if (len(c.stamp) > 14) problems.push(`stamp ${len(c.stamp)} 字，超过 14 字`);
  if ((c.crew ?? []).length > 2) problems.push("封面角色最多 2 个");
  (c.crew ?? []).forEach((x, i) => problems.push(...(ctx.checkChar?.(x, `封面第 ${i + 1} 个角色`) ?? [])));
  if (len(c.crew_say) > 12) problems.push(`crew_say ${len(c.crew_say)} 字，超过 12 字`);
  if (!c.photo?.license) problems.push("照片缺少协议");
  return problems;
}
