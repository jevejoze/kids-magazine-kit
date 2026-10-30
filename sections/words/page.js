// 单词屋：波波鼠带 3 个新单词，各配图标、中文、例句，划线标出目标词
const lines = n => `<div class="lines">${"<i></i>".repeat(n)}</div>`;
const hl = (text, word) => word ? text.replace(new RegExp(`\\b(${word}\\w*)`, "i"), "<b>$1</b>") : text;

export function render(W, kit) {
  const { topBar, ch, foot } = kit;
  return `${topBar("🔤 波波鼠单词屋 · Word House", W.grammar ? `✏️ ${W.grammar}` : undefined)}
  <div class="intro">${ch("mouse:wave:190")}<div class="bub en">${W.intro}</div></div>
  ${W.items.map((w, i) => `<div class="box w c${i}"><div class="ico">${w.icon}</div><div class="wd">
    <div class="word en">${w.word}${w.new ? `<em class="fun">新词</em>` : ""}</div>
    <div class="cn fun">${w.cn}</div><div class="ex en">${hl(w.example, w.word)}</div></div></div>`).join("")}
  <div class="box task"><div class="fun">✍️ 轮到你：${W.task}</div>${lines(W.lines || 2)}</div>
  ${foot("主持：波波鼠 Boba Mouse")}`;
}
