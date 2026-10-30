// 信箱（最后一页）：几句关于本期的问题，孩子口头答、家长拍照或转述都行
const lines = n => `<div class="lines">${"<i></i>".repeat(n)}</div>`;
const picks = (items, many) => `<div class="pick${many ? " many" : ""}">${items.map(x => `<span>${x}</span>`).join("")}</div>`;

export function render(M, kit) {
  const { topBar, foot, toc } = kit;
  const PAGES = toc.filter(([, t]) => t !== "信箱").map(([e, t]) => e + t);
  return `${topBar("💌 编辑部信箱 · Mailbox")}
  <div class="box letter fun">${M.hello || M.letter}</div>
  <div class="box checkin fun"><h3>📝 今天这期，告诉编辑部</h3>
    <div class="row"><b>👍 最喜欢哪一页？</b>${picks(PAGES, PAGES.length > 5)}</div>
    <div class="row"><b>👎 哪一页不太喜欢？</b>${picks(PAGES, PAGES.length > 5)}</div>
    <div class="row"><b>今天难不难？</b>${picks(["😴 太简单", "🤔 刚刚好", "🤯 有点难"])}</div>
    <div class="row"><b>💡 今天想到了什么有趣的问题？</b>${lines(2)}</div>
    <div class="row"><b>👀 今天看到了什么有意思的事？</b>${lines(2)}</div>
    ${M.ask_zh ? `<div class="row"><b>❓ ${M.ask_zh}</b>${lines(1)}</div>` : ""}</div>
  ${foot((M.send_note || "说给家长听") + " · 明天见！See you tomorrow!")}`;
}
