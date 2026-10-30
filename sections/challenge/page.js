// 挑战卡：默认一道中文谜题；仅在明确启用时兼容旧英文三关
const lines = n => `<div class="lines">${"<i></i>".repeat(n)}</div>`;
const answerText = (value, escapeText) => escapeText(Array.isArray(value) ? value.join("；") : value ?? "");

export function render(P, kit) {
  const { topBar, ch, foot, wrapChineseWords, escapeText, issue } = kit;
  const answers = issue._answers ?? {};
  return { class: P.english?.length ? "with-english" : "", html: `${topBar("🧩 捣蛋浣熊的挑战")}
  <div class="taunt">${ch("raccoon:smirk:136:" + (P.prop || ""))}<div class="bub"><span class="taunt-text">${wrapChineseWords(P.taunt_zh)}</span>${P.english?.length && P.taunt_en ? `<span class="en">${escapeText(P.taunt_en)}</span>` : ""}</div></div>
  <div class="puz"><div class="puzzle-label">浣熊出题</div><h3 class="fun">${wrapChineseWords(P.puzzle.title)}</h3><div class="body">${wrapChineseWords(P.puzzle.body)}</div>
    ${P.puzzle.clues?.length ? `<div class="clue-label">${P.puzzle.clues.length} 条线索 · 每条都要满足</div><ol class="clues">${P.puzzle.clues.map(clue => `<li><span>${wrapChineseWords(clue)}</span></li>`).join("")}</ol>` : ""}
    ${P.puzzle.question ? `<div class="question"><b>你来判断</b><span>${wrapChineseWords(P.puzzle.question)}</span></div>` : ""}</div>
  ${P.english?.length ? `<div class="route">${P.english.map((e, i) => `<div class="box lv l${i}"><div class="st fun">第${i + 1}关<b>${"⭐".repeat(e.stars)}</b></div>
    <div class="q"><div class="cn fun">${e.cn}</div><div class="en">${e.en}</div></div></div>`).join("")}</div>` : ""}
  <div class="answer-key"><div class="answer-content"><b>参考答案 · 想好再看</b><p class="puzzle-key">${answerText(answers.puzzle, escapeText)}</p>
    ${P.english?.length ? `<p class="english-key">英文：${(answers.english || []).map((answer, i) => `${i + 1}. ${answerText(answer, escapeText)}`).join("　")}</p>` : ""}</div></div>
  ${foot("想好了？转动平板，核对本页答案")}` };
}
