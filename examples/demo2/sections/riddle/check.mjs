// 脑筋急转弯的按页校验：check(riddle, ctx) → 问题列表（不带步骤前缀）
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;

export function check(r) {
  const problems = [], need = (ok, msg) => { if (!ok) problems.push(msg); };
  need(r.riddle !== undefined && r.riddle !== null && r.riddle !== "", "缺少字段 riddle");
  need(r.hint !== undefined && r.hint !== null && r.hint !== "", "缺少字段 hint");
  need(r.answer !== undefined && r.answer !== null && r.answer !== "", "缺少字段 answer");
  need(len(r.riddle) <= 40, `riddle ${len(r.riddle)} 字，超过 40`);
  need(len(r.hint) <= 20, `hint ${len(r.hint)} 字，超过 20`);
  need(len(r.answer) <= 20, `answer ${len(r.answer)} 字，超过 20`);
  return problems;
}
