// 信箱的按页校验：check(mailbox, ctx) → 问题列表（不带步骤前缀）
const len = s => [...String(s ?? "").replace(/<[^>]+>/g, "")].length;

export function check(m) {
  const problems = [], need = (ok, msg) => { if (!ok) problems.push(msg); };
  need(m.hello !== undefined && m.hello !== null && m.hello !== "", "缺少字段 hello");
  need(len(m.hello) <= 60, `开头问候 ${len(m.hello)} 字，超过 60`);

  // 翻车榜校验
  need(m.blunder && typeof m.blunder === "object", "缺少翻车榜字段 blunder");
  if (m.blunder) {
    need(m.blunder.who, "翻车榜缺少责任人 blunder.who");
    need(m.blunder.title, "翻车榜缺少标题 blunder.title");
    need(len(m.blunder.title) <= 16, `翻车榜标题 ${len(m.blunder.title)} 字，超过 16`);
    need(m.blunder.desc, "翻车榜缺少过程描述 blunder.desc");
    need(len(m.blunder.desc) <= 100, `翻车榜过程描述 ${len(m.blunder.desc)} 字，超过 100`);
  }

  // 秘密树洞 / 蠢问题挑战校验
  need(m.treehole && typeof m.treehole === "object", "缺少树洞字段 treehole");
  if (m.treehole) {
    need(m.treehole.target, "树洞缺少对象角色 treehole.target");
    need(m.treehole.question, "树洞缺少互动提问 treehole.question");
    need(len(m.treehole.question) <= 30, `树洞互动提问 ${len(m.treehole.question)} 字，超过 30`);
    if (m.treehole.hint) {
      need(len(m.treehole.hint) <= 60, `树洞示范提示 ${len(m.treehole.hint)} 字，超过 60`);
    }
  }

  // 兼容旧字段
  if (m.ask_zh) {
    need(len(m.ask_zh) <= 40, `本期问题 ${len(m.ask_zh)} 字，超过 40`);
  }

  return problems;
}

const FAMILY = /爸爸|妈妈|爷爷|奶奶|外公|外婆|姥姥|姥爷|哥哥|姐姐|家人/g;
const OBSOLETE_SURVEY = /最喜欢哪[一]?页|哪[一]?页不[太]?喜欢|今天难不难|打卡问题|作业评价/g;

// 这一页的讲读校验：checkNarration(lines, ctx) → 问题列表
//   规矩 13：说给对的人（和 send_note 里的人一致）；规矩 17：不出猜谜题、不公布上期答案
//   重构规范：彻底删除 5 个机械问卷，严禁出现作业评价式机械提问
//   ctx.sendNote：本期 magazine.yaml 的 send_note
export function checkNarration(lines, ctx) {
  const problems = [];
  const sendTo = String(ctx.sendNote ?? "").match(FAMILY) ?? [];
  lines.filter(l => l.lang === "zh").forEach(l => {
    const t = l.text;
    [...t.matchAll(/(?:说给|讲给|发给|告诉|拿给)(爸爸|妈妈|爷爷|奶奶|外公|外婆|姥姥|姥爷|哥哥|姐姐|家人)/g)].forEach(m => {
      if (sendTo.length && !sendTo.includes(m[1])) problems.push(`说"${m[0]}"，send_note 写的是"${ctx.sendNote}"`);
    });
    if (/你猜/.test(t)) problems.push(`信箱不再出猜谜题，只念树洞互动与反套路提问：${t}`);
    if (/上期答案|上期.*谜题.*答案/.test(t)) problems.push(`信箱不再公布上期答案：${t}`);
    if (OBSOLETE_SURVEY.test(t)) problems.push(`信箱已重构为树洞与翻车台，严禁出现作业评价式机械提问：${t}`);
  });
  return problems;
}
