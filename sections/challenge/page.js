// 挑战卡：全面支持图文解谜卡片（草图、密码盘、镜像字、找茬）
const lines = n => `<div class="lines">${"<i></i>".repeat(n)}</div>`;
const answerText = (value, escapeText) => escapeText(Array.isArray(value) ? value.join("；") : value ?? "");

const renderClueItem = (clue, kit) => {
  const m = String(clue).match(/^\[([^\]]+)\]\s*(.*)$/);
  if (m) {
    const tag = m[1], rest = m[2];
    const isMirror = tag.includes("镜像") || tag.includes("反转");
    const isCipher = tag.includes("摩斯") || tag.includes("密码");
    return `<span class="clue-tag clue-tag-${isMirror ? "mirror" : isCipher ? "cipher" : "default"}">${kit.escapeText(tag)}</span><span class="clue-text${isMirror ? " clue-has-mirror" : ""}">${kit.wrapChineseWords(rest)}</span>`;
  }
  return `<span>${kit.wrapChineseWords(clue)}</span>`;
};

const renderVisualCards = (cards, kit) => {
  const { escapeText, wrapChineseWords } = kit;
  if (!Array.isArray(cards) || !cards.length) return "";
  return `<div class="visual-cards">${cards.map(c => `
    <div class="visual-card${c.mirror ? " is-mirror" : ""}${c.cipher ? " is-cipher" : ""}">
      ${c.badge ? `<span class="card-badge">${escapeText(c.badge)}</span>` : ""}
      ${c.symbol ? `<div class="card-symbol fun">${escapeText(c.symbol)}</div>` : ""}
      ${c.text ? `<div class="card-text${c.mirror ? " mirror-text" : ""}">${c.mirror ? escapeText(c.text) : wrapChineseWords(c.text)}</div>` : ""}
      ${c.hint ? `<div class="card-hint">${wrapChineseWords(c.hint)}</div>` : ""}
    </div>
  `).join("")}</div>`;
};

const renderDrawers = (drawers, kit) => {
  const { escapeText } = kit;
  if (!Array.isArray(drawers) || !drawers.length) return "";
  return `<div class="drawer-grid">${drawers.map((d, i) => {
    const num = typeof d === "object" ? (d.num ?? i + 1) : d;
    const label = typeof d === "object" ? d.label ?? "" : "";
    const icon = typeof d === "object" ? d.icon ?? "" : "";
    return `<div class="drawer-box">
      <span class="drawer-handle"></span>
      <span class="drawer-num">${escapeText(num)}</span>
      ${label ? `<span class="drawer-label">${escapeText(label)}</span>` : ""}
      ${icon ? `<span class="drawer-icon">${icon}</span>` : ""}
    </div>`;
  }).join("")}</div>`;
};

export function render(P, kit) {
  const { topBar, ch, foot, wrapChineseWords, escapeText, issue, slots = {} } = kit;
  const trickster = slots.trickster || "raccoon";
  const answers = issue._answers ?? {};
  const puz = P.puzzle || {};
  const hasVisual = !!(puz.cards?.length || puz.sketch || puz.drawers?.length || puz.visual);
  const puzLabel = puz.kind === "sketch" ? "现场草图 · 破译出题"
    : puz.kind === "cipher" ? "密码破译 · 挑战出题"
    : puz.kind === "mirror" ? "镜像字谜 · 挑战出题"
    : puz.kind === "spot_diff" ? "视觉找茬 · 挑战出题"
    : "挑战出题";

  return { class: [P.english?.length ? "with-english" : "", hasVisual ? "has-visual" : ""].filter(Boolean).join(" "), html: `${topBar("🧩 捣蛋鬼的挑战")}
  <div class="taunt">${ch(`${trickster}:smirk:136:` + (P.prop || ""))}<div class="bub"><span class="taunt-text">${wrapChineseWords(P.taunt_zh)}</span>${P.english?.length && P.taunt_en ? `<span class="en">${escapeText(P.taunt_en)}</span>` : ""}</div></div>
  <div class="puz"><div class="puzzle-label">${puzLabel}</div><h3 class="fun">${wrapChineseWords(puz.title)}</h3><div class="body">${wrapChineseWords(puz.body)}</div>
    ${puz.sketch ? `<div class="visual-sketch">${puz.sketch}</div>` : ""}
    ${renderVisualCards(puz.cards, kit)}
    ${renderDrawers(puz.drawers, kit)}
    ${puz.clues?.length ? `<div class="clue-label">${puz.clues.length} 条线索 · 每条都要满足</div><ol class="clues">${puz.clues.map(clue => `<li>${renderClueItem(clue, kit)}</li>`).join("")}</ol>` : ""}
    ${puz.question ? `<div class="question"><b>你来判断</b><span>${wrapChineseWords(puz.question)}</span></div>` : ""}</div>
  ${P.english?.length ? `<div class="route">${P.english.map((e, i) => `<div class="box lv l${i}"><div class="st fun">第${i + 1}关<b>${"⭐".repeat(e.stars)}</b></div>
    <div class="q"><div class="cn fun">${e.cn}</div><div class="en">${e.en}</div></div></div>`).join("")}</div>` : ""}
  <div class="answer-key"><div class="answer-content"><b>参考答案 · 想好再看</b><p class="puzzle-key">${answerText(answers.puzzle, escapeText)}</p>
    ${P.english?.length ? `<p class="english-key">英文：${(answers.english || []).map((answer, i) => `${i + 1}. ${answerText(answer, escapeText)}`).join("　")}</p>` : ""}</div></div>
  ${foot("想好了？转动平板，核对本页答案")}` };
}
