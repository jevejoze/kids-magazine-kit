// 今日一问：4 格漫画 + 图解 + 便利贴冷知识；版面按前两格 → 图解 → 后两格阅读
const chatRow = (b, bi, p, pi, kit) => {
  const { draw, escapeText, wrapChineseWords } = kit;
  const speaker = b.who || p.chars[bi] || p.chars[0] || "";
  const spec = speaker.includes(":") ? speaker : p.chars.find(s => s.split(":")[0] === speaker) || speaker;
  const [whoKey, mood = "normal", size = "110", props = ""] = spec.split(":");
  const side = b.side || (p.bubbles.length > 1 ? (bi % 2 === 0 ? "left" : "right") : (pi % 2 === 0 ? "left" : "right"));
  const ava = `<div class="chat-ava ${whoKey}">${draw(whoKey, mood, Number(size), props)}</div>`;
  const bub = `<div class="bub who-${whoKey} ${side} ${b.lang === "en" ? "en" : "fun"}"><span class="bubble-text">${b.lang === "en" ? escapeText(b.text) : wrapChineseWords(b.text, false)}</span></div>`;
  return `<div class="chat-row ${side}">${side === "left" ? ava + bub : bub + ava}</div>`;
};
const comicPanels = (panels, start, kit) => panels.map((p, j) => {
  const i = start + j;
  return `<div class="box panel p${i}"><div class="panel-head"><span class="n en">${i + 1}</span>${p.title ? `<span>${p.title}</span>` : ""}</div>
    <div class="bubs ${p.bubbles.length > 1 ? "pair" : "solo"}">${p.bubbles.map((b, bi) => chatRow(b, bi, p, i, kit)).join("")}</div></div>`;
}).join("");

export function render(C, kit) {
  const { issue: D, topBar, foot, escapeText, wrapChineseWords } = kit;
  return `${topBar(`${C.theme_icon || "🤔"} 今日一问 · Big Question`, C.tool ? `<span class="toolpill fun">🧰 ${C.tool}</span>` : undefined)}
  <div class="h1 fun">${wrapChineseWords(C.title_zh || D.question.zh)}<span class="en">${C.title_en || D.question.en}</span></div>
  <div class="grid upper">${comicPanels(C.panels.slice(0, 2), 0, kit)}</div>
  ${C.diagram ? `<div class="box diagram"><div class="dl fun">${C.diagram_title || "🦉 咕咕博士画给你看"}</div>${C.diagram}
    ${C.takeaway ? `<div class="takeaway"><b>所以</b><span>${escapeText(C.takeaway)}</span></div>` : ""}</div>` : ""}
  <div class="grid lower">${comicPanels(C.panels.slice(2), 2, kit)}</div>
  <div class="fact"><b>${C.fact_title || "💡 再发现"}</b><span>${C.fact}</span></div>
  ${foot(C.host || "主持：团子狗 × 咕咕博士")}`;
}
