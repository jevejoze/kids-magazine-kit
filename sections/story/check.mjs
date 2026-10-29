// 小剧场的按页校验：check(story, ctx) → 问题列表（不带步骤前缀）
//   ctx.checkChar(spec, at) → 角色写法的问题列表
//   ctx.stateful：数据目录有 state/story/ 时为 true，这时要给 threads_after
const REQUIRED = ["ep", "title_zh", "title_en", "paragraphs", "scene", "clue", "tbc", "secret"];
const MAX_CHARS = 300;
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;

export function check(story, ctx = {}) {
  const problems = [];
  for (const k of REQUIRED) if (story[k] === undefined || story[k] === null || story[k] === "") problems.push(`缺少字段 ${k}`);
  const n = len((story.paragraphs ?? []).join(" ").replace(/\s/g, ""));
  if (n > MAX_CHARS) problems.push(`故事 ${n} 字，超过 ${MAX_CHARS}`);
  (story.scene ?? []).forEach((x, i) => problems.push(...(ctx.checkChar?.(x, `scene[${i}]`) ?? [])));
  if (ctx.stateful) {
    const t = story.threads_after;
    if (!Array.isArray(t) || !t.every(x => typeof x === "string" && x.trim())) problems.push("缺少 threads_after：写本集之后还没回收的伏笔，每条一句（都回收了就写 []）");
  }
  return problems;
}
