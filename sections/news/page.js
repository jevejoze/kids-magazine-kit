// 环球小报：大图海报版分页输出（每条新闻一张独立海报卡片）或经典版（1 张卡片，1 条大头条 + 1-2 条次条）
const storyBox = (n, picCls = "poster") => `<div class="box nw ${picCls}">
  <div class="pic" style="background-image:url('${n.photo}');background-position:${n.photo_pos || "center"}"></div>
  <div class="txt"><div class="loc fun">${n.flag} ${n.place}</div><h3 class="fun">${n.title}</h3><p>${n.text}${n.word ? `<span class="kw en">🔑 ${n.word.en} <small class="fun">${n.word.zh}</small></span>` : ""}</p></div>
</div>`;
const askBox = NW => NW.ask_zh ? `<div class="box ask2 fun">💬 ${NW.ask_zh}${NW.ask_en ? `<br><span class="en">${NW.ask_en}</span>` : ""}</div>` : "";
const POSTER_LABELS = ["头条", "第 2 条", "第 3 条"];

export function render(NW, kit) {
  const { topBar, foot } = kit;
  const items = NW.items || [];
  const n = items.length;
  const isPoster = NW.layout === "poster";

  if (isPoster) {
    // 旧期的 issue.json 没有逐条署名：整串 credits 印在最后一张，照片不至于没有署名
    const hasItemCredits = items.some(item => item.credit);
    return items.map((item, idx) => {
      const isLast = idx === n - 1;
      const right = n > 1 ? POSTER_LABELS[idx] : NW.week;
      const footText = [item.credit && `照片：${item.credit}`, NW.foot].filter(Boolean).join(" · ");
      return `${topBar("🌏 环球小报 · World News", right)}
      ${storyBox(item, "poster")}
      ${isLast ? askBox(NW) : ""}
      ${isLast && !hasItemCredits && NW.credits ? `<div class="credit2 en">${NW.credits}</div>` : ""}
      ${foot(footText)}`;
    });
  }

  // 经典版单页排版
  const isLarge = n === 2;
  const body = isLarge
    ? `${storyBox(items[0], "lead")}${storyBox(items[1], "sub")}`
    : `${storyBox(items[0], "lead")}<div class="pair">${items.slice(1, 3).map(n => storyBox(n, "")).join("")}</div>`;
  return `${topBar("🌏 环球小报 · World News", NW.week)}
  ${body}
  ${askBox(NW)}
  <div class="credit2 en">${NW.credits}</div>
  ${foot(NW.foot || "")}`;
}
