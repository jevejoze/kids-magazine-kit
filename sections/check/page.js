// 真的假的（每天一页）：一条网上流传的说法，快脑袋先投票，慢脑袋按线索查，答案倒着印；有思维课表时选项和查证工具跟着本周换
const lines = n => `<div class="lines">${"<i></i>".repeat(n)}</div>`;

export function render(CK, kit) {
  const { topBar, foot, next } = kit;
  const choices = CK?.choices ?? ["✅ 真的", "❌ 假的", "🤔 说不清"];
  const tools = CK?.tools ?? [["👤 谁说的？", "他怎么知道的"], ["🧪 有证据吗？", "实验、照片、数字"], ["📚 别处怎么说？", "再找一个来源"]];
  return `${topBar("🕵️ 真的假的 · True or False?")}
  <div class="box post${CK.photo ? " has-pic" : ""}"><div class="txt"><div class="ph fun">📱 ${CK.where}</div><div class="claim fun">${CK.claim}</div><div class="likes en">👍 ${CK.likes || "10万+"}　💬 ${CK.comments || "2,333"}</div></div>
    ${CK.photo ? `<div class="pic" style="background-image:url('${CK.photo}');background-position:${CK.photo_pos || "center"}"></div>` : ""}</div>
  <div class="vote fun">你的快脑袋说：${choices.map(c => `<span>${c}</span>`).join("")}</div>
  <div class="tools fun">${tools.map(([t, s]) => `<span>${t}<small>${s}</small></span>`).join("")}</div>
  <div class="box clues fun"><h3>🦉 慢脑袋查一查</h3>${CK.clues.map((c, i) => `<p><b>${i + 1}</b>${c}</p>`).join("")}</div>
  <div class="box mine fun"><h3>🕵️ 我的结论：${CK.choices ? choices.map(c => c.replace(/^\S+\s/, "")).join(" / ") : "真 / 假"}，因为……</h3>${lines(2)}</div>
  <div class="upside fun"><span>👀 倒过来看答案：</span>${CK.verdict}</div>
  ${CK.credit ? `<div class="credit2 en">${CK.credit}</div>` : ""}
  ${foot(`看完再倒过来对答案${next("真的假的")}`)}`;
}
