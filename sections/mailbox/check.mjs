// 信箱的按页校验：check(mailbox, ctx) → 问题列表（不带步骤前缀）
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;

export function check(m) {
  const problems = [], need = (ok, msg) => { if (!ok) problems.push(msg); };
  need(m.hello !== undefined && m.hello !== null && m.hello !== "", "缺少字段 hello");
  need(len(m.hello) <= 60, `开头问候 ${len(m.hello)} 字，超过 60`);
  need(len(m.ask_zh) <= 30, `本期问题 ${len(m.ask_zh)} 字，超过 30`);
  return problems;
}

const FAMILY = /爸爸|妈妈|爷爷|奶奶|外公|外婆|姥姥|姥爷|哥哥|姐姐|家人/g;

// 这一页的讲读校验：checkNarration(lines, ctx) → 问题列表
//   规矩 13：说给对的人（和 send_note 里的人一致）；规矩 17：不出猜谜题、不公布上期答案
//   ctx.sendNote：本期 magazine.yaml 的 send_note
export function checkNarration(lines, ctx) {
  const problems = [];
  const sendTo = String(ctx.sendNote ?? "").match(FAMILY) ?? [];
  lines.filter(l => l.lang === "zh").forEach(l => {
    const t = l.text;
    [...t.matchAll(/(?:说给|讲给|发给|告诉|拿给)(爸爸|妈妈|爷爷|奶奶|外公|外婆|姥姥|姥爷|哥哥|姐姐|家人)/g)].forEach(m => {
      if (sendTo.length && !sendTo.includes(m[1])) problems.push(`说"${m[0]}"，send_note 写的是"${ctx.sendNote}"`);
    });
    if (/你猜/.test(t)) problems.push(`信箱不再出猜谜题，只念 ask_zh 和打卡问题：${t}`);
    if (/上期答案|上期.*谜题.*答案/.test(t)) problems.push(`信箱不再公布上期答案：${t}`);
  });
  return problems;
}
