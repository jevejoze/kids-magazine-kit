// 传说怪物档案（每周一张）：一张可收集的卡片——传说里的样子和真身并排，传说、科学家怎么说、真实原型
const meter = (n, icon) => `<span class="meter">${icon.repeat(n)}<i>${icon.repeat(5 - n)}</i></span>`;

export function render(CR, kit) {
  const { topBar, ch, foot, next } = kit;
  return `${topBar(CR.series || "🐙 传说怪物档案 · Legend Files", `No.${String(CR.no).padStart(3, "0")}`)}
  <div class="card-photo"><div class="box half legend"><div class="pic" style="background-image:url('${CR.legend}');background-position:${CR.legend_pos || "center"}"></div>
      <div class="lab fun">📜 传说里的样子</div><div class="credit3 en">${CR.legend_credit}</div></div>
    <div class="box half real"><div class="pic" style="background-image:url('${CR.photo}');background-position:${CR.photo_pos || "center"}"></div>
      <div class="lab fun">📷 可能的真身</div>${CR.tag ? `<div class="depth fun">${CR.tag}</div>` : ""}<div class="credit3 en">${CR.credit}</div></div></div>
  <div class="name"><div class="zh fun">${CR.name_zh}</div>
    <div class="en">${CR.parts.map(p => `<span><b>${p.en}</b><small class="fun">${p.zh}</small></span>`).join("<em>+</em>")}</div></div>
  <div class="stats">${CR.stats.map(s => `<div class="box st"><small class="fun">${s.k}</small><b class="fun">${s.v}</b></div>`).join("")}</div>
  <div class="box meters fun">${CR.meters.map(m => `<div>${m.label} ${meter(m.n, m.icon)}</div>`).join("")}</div>
  ${CR.boxes.map((x, i) => `<div class="box power fun b${i}"><b>${x.title}</b>${x.text}</div>`).join("")}
  ${CR.fast ? `<div class="brains">
    <div class="br">${ch("dog:surprise:120")}<div class="bub fun"><small>快脑袋：</small>${CR.fast}</div></div>
    <div class="br slow">${ch("owl:think:120:magnifier")}<div class="bub fun"><small>慢脑袋：</small>${CR.slow}</div></div></div>` : ""}
  ${foot(CR.foot || `收集怪物卡，凑齐一本档案！${next("怪物档案")}`)}`;
}
