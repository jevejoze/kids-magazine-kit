// 真的假的（每天一页）：一条网上流传的说法，快脑袋先圈一次，慢脑袋按线索查完再圈一次，答案倒着印；有思维课表时选项跟着本周换
// 查证工具（tools）不印在页面上，只给讲读稿用：印出来会在看线索之前把答案说破
export function render(CK, kit) {
  const { topBar, foot } = kit;
  const choices = CK?.choices ?? ["✅ 真的", "❌ 假的", "🤔 说不清"];
  const options = choices.map(c => `<span>${c}</span>`).join("");
  return `${topBar("🕵️ 真的假的 · Really?")}
  <div class="box post${CK.photo ? " has-pic" : ""}"><div class="txt"><div class="ph fun">📱 ${CK.where}</div><div class="claim fun">${CK.claim}</div><div class="likes en">👍 ${CK.likes || "10万+"}　💬 ${CK.comments || "2,333"}</div></div>
    ${CK.photo ? `<div class="pic" style="background-image:url('${CK.photo}');background-position:${CK.photo_pos || "center"}"></div>` : ""}</div>
  <div class="vote fun">你的快脑袋说：${options}</div>
  <div class="box clues fun"><h3>🦉 慢脑袋查一查</h3>${CK.clues.map((c, i) => `<p><b>${i + 1}</b>${c}</p>`).join("")}</div>
  <div class="vote again fun">慢脑袋改主意了吗？${options}</div>
  <div class="upside fun"><span>👀 倒过来看答案：</span>${CK.verdict}</div>
  ${foot(CK.credit ? `照片：${CK.credit}` : "")}`;
}
