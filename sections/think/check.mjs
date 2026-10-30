// 周末思辨的按页校验：check(think, ctx) → 问题列表（不带步骤前缀）
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;
const META_SPOILER = /思维本领|思维方法|今天学|今天练|本周练/;

export function check(t, ctx) {
  const problems = [], need = (ok, msg) => { if (!ok) problems.push(msg); };
  const fields = (obj, keys) => keys.forEach(key => need(obj[key] !== undefined && obj[key] !== null && obj[key] !== "", `缺少字段 ${key}`));
  fields(t, ["title", "story", "sides", "role", "deeper", "parent_guide", "source", "log_update"]);
  need(len(t.title) <= 18, `话题 ${len(t.title)} 字，超过 18`);
  need(len(t.story) <= 120, `故事 ${len(t.story)} 字，超过 120`);
  need(t.sides?.length === 2, "sides 要 2 个成员，各站一边");
  t.sides?.forEach((x, i) => {
    problems.push(...(ctx.checkChar?.(x.who, `第 ${i + 1} 个观点角色`) ?? []));
    need(len(x.say) <= 36, `第 ${i + 1} 个观点 ${len(x.say)} 字，超过 36`);
  });
  need(len(t.role) <= 40, `角色代入 ${len(t.role)} 字，超过 40`);
  need(t.deeper?.length === 2, "deeper 要 2 个追问");
  t.deeper?.forEach((x, i) => need(len(x) <= 30, `第 ${i + 1} 个追问 ${len(x)} 字，超过 30`));
  need(!t.photo_url || t.photo_credit, "有配图就写 photo_credit");
  need(!META_SPOILER.test([t.title, t.story, ...(t.sides ?? []).map(s => s.say), t.role, ...(t.deeper ?? [])].join(" ")), "周末思辨正文不得点破「思维本领/今天练」等课表字眼");
  return problems;
}
