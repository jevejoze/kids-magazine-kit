// 经典连载 · 周五音乐盒的按页校验：check(serial, ctx) → 问题列表（不带步骤前缀）
//   kind、crew 这些各 kind 共用的检查在 pipeline-lib 里
const REQUIRED = ["title_zh", "title_en", "by", "paragraphs", "tasks", "crew", "where", "photo_url", "photo_credit"];
const MAX_CHARS = 180, TASKS = 3;
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;

export function check(r) {
  const problems = [];
  for (const k of REQUIRED) if (r[k] === undefined || r[k] === null || r[k] === "") problems.push(`缺少字段 ${k}`);
  const n = len((r.paragraphs ?? []).join("").replace(/\s/g, ""));
  if (n > MAX_CHARS) problems.push(`介绍 ${n} 字，超过 ${MAX_CHARS}`);
  if (r.tasks?.length !== TASKS) problems.push(`任务要 ${TASKS} 个`);
  return problems;
}
