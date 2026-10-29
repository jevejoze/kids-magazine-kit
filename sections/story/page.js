// 小剧场：上面是阁楼场景，下面是故事；≤ 4 段时按段落拆成一幕一幕，谁说话就画谁
// 角色按槽位找：expert 讲道理、english 和 asker 对话、trickster 捣蛋；名字和别名来自 cast
const attic = night => `<svg class="bg" viewBox="0 0 952 340" preserveAspectRatio="none"><path d="M0 0 H952 V250 H0z" fill="#FFF1D6"/>
  <path d="M0 0 L300 0 L0 150z M952 0 L652 0 L952 150z" fill="#E7C9A0"/><path d="M0 150 L300 0 M952 150 L652 0" stroke="#4A3B32" stroke-width="5"/>
  <circle cx="476" cy="96" r="62" fill="${night ? "#2D3A66" : "#BFE3FF"}" stroke="#4A3B32" stroke-width="6"/><path d="M476 34 V158 M414 96 H538" stroke="#4A3B32" stroke-width="5"/>
  ${night ? `<circle cx="452" cy="74" r="14" fill="#FFE58F"/>` : ""}
  <path d="M0 250 H952 V340 H0z" fill="#D9A465"/><path d="M0 250 H952" stroke="#4A3B32" stroke-width="5"/>
  <path d="M40 300 h90 M300 320 h120 M640 296 h110" stroke="#B9844A" stroke-width="5" stroke-linecap="round"/>
  <rect x="780" y="180" width="120" height="90" fill="#E7B97F" stroke="#4A3B32" stroke-width="5"/><rect x="808" y="130" width="80" height="54" fill="#D9A465" stroke="#4A3B32" stroke-width="5"/></svg>`;

const acts = (ST, kit) => {
  const { draw, slots, mentions } = kit;
  return ST.paragraphs.map((p, i) => {
    const hasExpert = mentions(p, "expert");
    const hasEnglish = mentions(p, "english");
    const hasAsker = mentions(p, "asker");
    const hasTrickster = mentions(p, "trickster");
    const quotes = [...p.matchAll(/“([^”]+)”/g)].map(m => m[1]);
    const cleanNar = p.replace(/“[^”]+”/g, "").replace(/：\s*/g, " ").trim();

    if (hasEnglish && hasAsker && quotes.length >= 2) {
      return `<div class="act duo-act">
          <div class="duo-row mouse-row"><div class="char-fig">${draw(slots.english, "wave", 100)}</div><div class="bub fun">“${quotes[0]}”</div></div>
          <div class="duo-row dog-row"><div class="bub fun">“${quotes[1]}”</div><div class="char-fig">${draw(slots.asker, "happy", 104)}</div></div>
        </div>`;
    }
    if (hasExpert) {
      return `<div class="act owl-act"><div class="char-fig">${draw(slots.expert, "talk", 124, "magnifier")}</div>
          <div class="act-txt"><div class="bub fun">“${quotes.length ? quotes.join(" ") : p}”</div>${cleanNar ? `<div class="nar">${cleanNar}</div>` : ""}</div></div>`;
    }
    if (hasTrickster) {
      return `<div class="act raccoon-act"><div class="char-fig">${draw(slots.trickster, "smirk", 124)}</div>
          <div class="act-txt">${quotes.length ? `<div class="bub fun">“${quotes.join(" ")}”</div>` : ""}<div class="nar">${quotes.length ? cleanNar : p}</div></div></div>`;
    }
    const charKey = (ST.scene[i] || slots.asker).split(":")[0];
    return `<div class="act general-act"><div class="char-fig">${draw(charKey, "happy", 110)}</div>
        <div class="act-txt">${quotes.length ? `<div class="bub fun">“${quotes.join(" ")}”</div>` : ""}<div class="nar">${quotes.length ? cleanNar : p}</div></div></div>`;
  }).join("");
};

const body = (ST, kit) => {
  if (ST.paragraphs && ST.paragraphs.length <= 4) {
    return `<div class="story-acts">${acts(ST, kit)}</div>
      ${ST.clue ? `<div class="clue-box fun"><div class="key-icon">🔑</div><div class="clue-txt"><b>关键线索</b><span>${ST.clue}</span></div></div>` : ""}
      <div class="tbc fun"><span>📦 ${ST.tbc}</span></div>`;
  }
  return `<div class="box stage">${attic(ST.night)}<div class="scene">${ST.scene.map(kit.ch).join("")}</div></div>
    <div class="story ${ST.lang === "en" ? "en" : ""}">${ST.paragraphs.map(p => `<p>${p}</p>`).join("")}</div>
    <div class="tbc fun"><span>${ST.tbc}</span>${ST.clue ? `<span class="clue">🔍 ${ST.clue}</span>` : ""}</div>`;
};

export function render(ST, kit) {
  return `${kit.topBar("📖 编辑部小剧场 · Story Time", "EP." + ST.ep)}
  <div class="h1 fun">第${ST.ep}集　${ST.title_zh}<span class="en">${ST.title_en}</span></div>
  ${body(ST, kit)}
  ${kit.foot(ST.foot || `编辑部推理连载${kit.next("小剧场")}`)}`;
}
