// 环球小报：大图版（1 条大头条超大图 + 1 条精选次条大图）或经典版（1 条头条 + 2 条并排）
const story = (n, cls) => `<div class="box nw ${cls}"><div class="pic" style="background-image:url('${n.photo}');background-position:${n.photo_pos || "center"}"></div>
  <div class="txt"><div class="loc fun">${n.flag} ${n.place}</div><h3 class="fun">${n.title}</h3><p>${n.text}${n.word ? `<span class="kw en">🔑 ${n.word.en} <small class="fun">${n.word.zh}</small></span>` : ""}</p></div></div>`;

export function render(NW, kit) {
  const { topBar, foot, next } = kit;
  const isLarge = NW.items.length === 2;
  const body = isLarge
    ? `${story(NW.items[0], "lead")}${story(NW.items[1], "sub")}`
    : `${story(NW.items[0], "lead")}<div class="pair">${NW.items.slice(1, 3).map(n => story(n, "")).join("")}</div>`;
  return `${topBar("🌏 环球小报 · World News", NW.week)}
  ${body}
  <div class="box ask2 fun">💬 ${NW.ask_zh}<br><span class="en">${NW.ask_en}</span></div>
  <div class="credit2 en">${NW.credits}</div>
  ${foot(NW.foot || `新闻来源已交叉核实${next("环球小报")}`)}`;
}
