// 传说怪物档案的按页校验：check(creature, ctx) → 问题列表（不带步骤前缀）
const REQUIRED = ["no", "name_zh", "parts", "legend_url", "legend_credit", "photo_url", "photo_credit", "stats", "meters", "boxes", "fast", "slow", "sources", "log_update"];
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;

export function check(r) {
  const problems = [], need = (ok, msg) => { if (!ok) problems.push(msg); };
  for (const k of REQUIRED) need(r[k] !== undefined && r[k] !== null && r[k] !== "", `缺少字段 ${k}`);
  need(len(r.name_zh) <= 8, `名字 ${len(r.name_zh)} 字，超过 8`);
  need(r.stats?.length === 3, "stats 要 3 格");
  need(r.meters?.length >= 2 && r.meters?.length <= 3, "meters 要 2–3 条");
  r.meters?.forEach(m => need(m.n >= 1 && m.n <= 5, `${m.label} 的格数要 1–5：${m.n}`));
  need(r.boxes?.length === 3, "boxes 要 3 块：传说里说、科学家怎么说、真实原型");
  r.boxes?.forEach((x, i) => need(len(x.text) <= 60, `第 ${i + 1} 块 ${len(x.text)} 字，超过 60`));
  need(len(r.fast) <= 24 && len(r.slow) <= 24, "快脑袋、慢脑袋各 ≤ 24 字");
  need((r.sources ?? []).length >= 2, "要 2 个来源");
  return problems;
}
