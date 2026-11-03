// 小剧场的按页校验：check(story, ctx) → 问题列表（不带步骤前缀）
//   ctx.checkChar(spec, at) → 角色写法的问​​题列表
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

// 小剧场讲读校验：checkNarration(lines, ctx) → 问题列表
//   角色争辩与现场对质：除旁白外需要角色对白
//   音效与悬念推进：包含音效或关键破绽处停顿留白
export function checkNarration(lines, ctx = {}) {
  const problems = [];
  const charLines = lines.filter(l => l.who !== "narrator");
  if (charLines.length < 2) problems.push("小剧场讲读需包含角色对质争辩，除旁白外至少有 2 句角色台词");
  const hasAudioCues = lines.some(l => l.sfx || (l.pause ?? 0) >= 2);
  if (!hasAudioCues) problems.push("小剧场讲读需包含音效或关键破绽处的留白停顿（sfx 或 pause ≥ 2）");
  return problems;
}
