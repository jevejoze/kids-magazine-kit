// 环球小报的按页校验：check(news, ctx) → 问题列表（不带步骤前缀）
const REQUIRED = ["week", "items", "ask_zh", "ask_en", "credits"];
const TALK = ["background", "scale", "follow_up"];
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;
const missing = (obj, keys) => keys.filter(k => obj[k] === undefined || obj[k] === null || obj[k] === "").map(k => `缺少字段 ${k}`);

export function check(n) {
  const problems = [...missing(n, REQUIRED)], need = (ok, msg) => { if (!ok) problems.push(msg); };
  need(n.items?.length === 3, "新闻要 3 条");
  n.items?.forEach((x, i) => {
    need(len(x.text) <= 50, `第 ${i + 1} 条 ${len(x.text)} 字，超过 50`);
    need((x.sources ?? []).length >= 2, `第 ${i + 1} 条要 2 个来源`);
    problems.push(...missing(x.talk ?? {}, TALK));
    need(x.photo_shows, `第 ${i + 1} 条缺少 photo_shows（照片里实际拍到了什么）`);
  });
  return problems;
}
