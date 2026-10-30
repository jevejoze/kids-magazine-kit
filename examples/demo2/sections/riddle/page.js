// 脑筋急转弯：一句谜语 + 一个提示，答案倒印在页底
export function render(R, kit) {
  const { topBar, ch, foot, wrapChineseWords } = kit;
  return `${topBar("🧠 脑筋急转弯 · Riddle")}
  <div class="riddle-box"><div class="char">${ch("dog:think:150")}</div>
    <div class="txt"><div class="riddle fun">${wrapChineseWords(R.riddle)}</div><div class="hint">💡 ${R.hint}</div></div></div>
  <div class="answer-key"><div class="answer-content">${R.answer}</div></div>
  ${foot("想好了？转过来看答案")}`;
}
