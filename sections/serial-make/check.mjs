// 经典连载 · 周五动手做的按页校验：check(serial, ctx) → 问题列表（不带步骤前缀）
//   kind、crew 这些各 kind 共用的检查在 pipeline-lib 里
//   折纸（craft: origami）用一张完整图式代替成品照片，3D 打印（craft: 3d）配模型照片和 4–8 步做法
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;

export function check(r) {
  const problems = [], need = (ok, msg) => { if (!ok) problems.push(msg); };
  const origami = r.craft === "origami";
  const required = ["title_zh", "title_en", "by", "paragraphs", "tasks", "crew", "where", ...(origami ? ["diagram_url", "diagram_credit", "diagram_steps"] : ["photo_url", "photo_credit"])];
  for (const k of required) need(r[k] !== undefined && r[k] !== null && r[k] !== "", `缺少字段 ${k}`);
  need(["origami", "3d"].includes(r.craft), `动手做的 craft 要写 origami 或 3d：${r.craft}`);
  const n = len((r.paragraphs ?? []).join("").replace(/\s/g, "")), max = origami ? 30 : 120;
  need(n <= max, `介绍 ${n} 字，超过 ${max}`);
  if (origami) {
    need(r.diagram_steps <= 12, `图式 ${r.diagram_steps} 步，超过 12`);
    need(r.tasks?.length === r.diagram_steps, `每一步图配一句话：图式 ${r.diagram_steps} 步，tasks ${r.tasks?.length} 句`);
    r.tasks?.forEach((t, i) => need(len(t) <= 14, `第 ${i + 1} 步 ${len(t)} 字，超过 14`));
  } else {
    need(r.tasks?.length >= 4 && r.tasks?.length <= 8, "3D 打印的步骤要 4–8 步");
    r.tasks?.forEach((t, i) => need(len(t) <= 24, `第 ${i + 1} 步 ${len(t)} 字，超过 24`));
  }
  return problems;
}
