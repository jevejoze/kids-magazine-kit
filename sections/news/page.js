// 环球小报：1 条头条 + 2 条小新闻，下面一道"你怎么看"
const story = (n, cls) => `<div class="box nw ${cls}"><div class="pic" style="background-image:url('${n.photo}');background-position:${n.photo_pos || "center"}"></div>
  <div class="txt"><div class="loc fun">${n.flag} ${n.place}</div><h3 class="fun">${n.title}</h3><p>${n.text}${n.word ? `<span class="kw en">🔑 ${n.word.en} <small class="fun">${n.word.zh}</small></span>` : ""}</p></div></div>`;

export function render(NW, kit) {
  const { topBar, foot, next } = kit;
  return `${topBar("🌏 环球小报 · World News", NW.week)}
  ${story(NW.items[0], "lead")}
  <div class="pair">${NW.items.slice(1, 3).map(n => story(n, "")).join("")}</div>
  <div class="box ask2 fun">💬 ${NW.ask_zh}<br><span class="en">${NW.ask_en}</span></div>
  <div class="credit2 en">${NW.credits}</div>
  ${foot(NW.foot || `新闻来源已交叉核实${next("环球小报")}`)}`;
}
