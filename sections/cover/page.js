// 封面：有 cover.photo 用照片封面，否则用角色封面
// 照片封面：顶部刊名条 + 下方照片。刊名条的颜色取自照片顶部（见 ready），照片顶端渐隐进刊名条
export function render(CV, kit) {
  const { issue: D, N, ch, toc: TOC, cast: GANG, coverFoot, wrapChineseWords } = kit;
  if (CV && CV.photo) return { class: "photo-cover", style: CV.strip ? `--strip:${CV.strip}` : "", html: `
  <div class="photo" style="background-image:url('${CV.photo}');background-position:${CV.photo_pos || "center"}"></div><div class="shade"></div>
  <div class="top"><span>${D.date} · ${D.weather}</span><span class="en">ISSUE ${N}</span></div>
  <div class="mast"><div class="zh fun">${D.masthead.zh}</div><div class="en">${D.masthead.en}</div></div>
  <div class="cover-bottom${CV.crew?.length ? " has-crew" : ""}">
    <div class="q"><div class="cover-labels">${CV.stamp ? `<span class="stamp en">${CV.stamp}</span>` : ""}${CV.asked_by ? `<span class="asked fun">💡 本期问题由${CV.asked_by}提出</span>` : ""}</div>
      <div class="t fun">${wrapChineseWords(D.question.zh)}</div><div class="en">${D.question.en}</div></div>
    ${CV.crew?.length ? `<div class="crew">${CV.crew_say ? `<div class="bub fun">${CV.crew_say}</div>` : ""}<div class="chs">${CV.crew.map(ch).join("")}</div></div>` : ""}
    <div class="credit en">${CV.credit}</div>
  </div>` };
  return `<div class="dots"></div>
  <div class="top"><span>${D.date} · ${D.weather}</span><span class="en">ISSUE ${N}</span></div>
  <div class="mast"><div class="zh fun">${D.masthead.zh}</div><div class="en">${D.masthead.en}</div></div>
  ${D.badge ? `<div class="badge fun">${D.badge.zh}<small class="en">${D.badge.en}</small></div>` : ""}
  <div class="gang">${(D.cover_gang || GANG).map(ch).join("")}</div>
  <div class="box q"><div class="lb fun">🐶 今天团子狗想知道……</div>
    <div class="t fun">${D.question.zh}</div><div class="en">${D.question.en}</div></div>
  <div class="toc fun">${TOC.map(([e, t]) => `<div><b>${e}</b>${t}</div>`).join("")}</div>
  ${coverFoot(D.cover_greeting || "编辑部全员向你问好！Hello!")}`;
}

// 刊名条取色：照片可见区域最上面 5% 的平均色；太灰就提一点亮度。JSON 写了 cover.strip 就用它。
// 刊名用深字还是白字，按刊名条的亮度定。render.mjs 截图前会等 window.READY
export async function ready(CV) {
  const card = document.querySelector("#cover .photo-cover");
  if (!card) return;
  let rgb;
  if (CV.strip) {
    const c = document.createElement("canvas").getContext("2d");
    c.fillStyle = CV.strip; c.fillRect(0, 0, 1, 1); rgb = [...c.getImageData(0, 0, 1, 1).data].slice(0, 3);
  } else {
    const box = card.querySelector(".photo"), img = new Image();
    img.src = CV.photo; await img.decode();
    const W = box.clientWidth, H = box.clientHeight, s = Math.max(W / img.width, H / img.height);
    const pos = getComputedStyle(box).backgroundPosition.split(" ").map(v => v.endsWith("%") ? parseFloat(v) / 100 : 0.5);
    const vw = W / s, vh = H / s, x0 = (img.width - vw) * pos[0], y0 = (img.height - vh) * (pos[1] ?? 0.5);
    const cv = document.createElement("canvas"); cv.width = 32; cv.height = 2;
    const c = cv.getContext("2d"); c.drawImage(img, x0, y0, vw, vh * 0.05, 0, 0, 32, 2);
    const px = c.getImageData(0, 0, 32, 2).data; rgb = [0, 0, 0];
    for (let i = 0; i < px.length; i += 4) for (let k = 0; k < 3; k++) rgb[k] += px[i + k] / 64;
    const [mx, mn] = [Math.max(...rgb), Math.min(...rgb)];
    if (mx - mn < 30 && mx < 200) rgb = rgb.map(v => Math.min(255, v + 24)); // 灰蒙蒙的天：提亮一点
    card.style.setProperty("--strip", `rgb(${rgb.map(Math.round).join(",")})`);
  }
  const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  card.classList.add(lum > 0.6 ? "light" : "dark");
}
