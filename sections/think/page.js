// 周末思辨（周五）：一个两边都有道理的话题，孩子先写下想法，周六和家人聊
const lines = n => `<div class="lines">${"<i></i>".repeat(n)}</div>`;

export function render(TK, kit) {
  const { topBar, ch, foot, next } = kit;
  return `${topBar("🗣️ 周末思辨 · Big Talk", "周六聊一聊")}
  <div class="h1 fun">${TK.title}${TK.title_en ? `<span class="en">${TK.title_en}</span>` : ""}</div>
  <div class="box story fun${TK.photo ? " has-pic" : ""}">${TK.photo ? `<div class="pic" style="background-image:url('${TK.photo}');background-position:${TK.photo_pos || "center"}"></div>` : ""}<p>${TK.story}</p></div>
  <div class="sides">${TK.sides.map((x, i) => `<div class="side s${i}"><div class="bub fun">${x.say}</div><div class="char-stage">${ch(x.who)}</div></div>`).join(`<div class="vs-emblem en">VS</div>`)}</div>
  <div class="box role fun"><b>🎭 换你来</b>${TK.role}</div>
  <div class="box deeper fun"><b>🤔 再想深一点</b>${TK.deeper.map(q => `<p>${q}</p>`).join("")}</div>
  <div class="box mine fun"><h3>✏️ 我的想法：______，因为……</h3>${lines(2)}
    <div class="after">周六聊完，我的想法：<span>没变</span><span>变了一点</span><span>完全变了</span></div></div>
  ${TK.credit ? `<div class="credit2 en">${TK.credit}</div>` : ""}
  ${foot(`周六和家人聊一聊，听听别人怎么想${next("周末思辨")}`)}`;
}
