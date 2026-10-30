// 信箱的按页校验：check(mailbox, ctx) → 问题列表（不带步骤前缀）
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;

export function check(m) {
  const problems = [], need = (ok, msg) => { if (!ok) problems.push(msg); };
  need(m.hello !== undefined && m.hello !== null && m.hello !== "", "缺少字段 hello");
  need(len(m.hello) <= 60, `开头问候 ${len(m.hello)} 字，超过 60`);
  need(len(m.ask_zh) <= 30, `本期问题 ${len(m.ask_zh)} 字，超过 30`);
  return problems;
}
