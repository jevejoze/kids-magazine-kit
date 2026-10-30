// 英文三关没有自己的页面：内容合并进挑战页（sections/challenge），由 buildIssue 把
// english、answers 并进 D.challenge.english、D._answers.english。本期数据永远不会有顶层
// D.english，所以这个 render 不会被调用，只是满足栏目包必须导出 render(data, kit) 的规定。
export function render() {
  return "";
}
