// 动手做（周五）：折纸切好的分步图（steps）一步一格；只有整张图式（diagram）就图式 + 两列提示；3D 打印是模型照片 + 4–8 步做法
const img = (url, pos) => `<div class="img" style="background-image:url('${url}')${pos ? `;background-position:${pos}` : ""}"></div>`;

const grid = SR => {
  const cols = SR.steps.length > 9 ? 4 : 3;
  return `<div class="box grid fun" style="--cols:${cols};--rows:${Math.ceil(SR.steps.length / cols)}">${SR.steps.map((s, i) => `<div class="cell">${img(s)}<p><b>${i + 1}</b>${SR.tasks[i]}</p></div>`).join("")}
    <small>${SR.where ? `${SR.where}　·　` : ""}<span class="en">图式 ${SR.diagram_credit}</span></small></div>`;
};

const diagram = SR => `<div class="box diagram">${img(SR.diagram)}<div class="credit3 en">${SR.diagram_credit}</div></div>
  <div class="box tasks steps fun">${SR.tasks.map((t, i) => `<p><b>${i + 1}</b>${t}</p>`).join("")}${SR.where ? `<small>${SR.where}</small>` : ""}</div>`;

const tasks = SR => `<div class="box tasks fun"><div class="lb">✂️ 跟着做</div>${SR.tasks.map((t, i) => `<p><b>${i + 1}</b>${t}</p>`).join("")}${SR.where ? `<small>${SR.where}</small>` : ""}</div>`;

export function render(SR, kit) {
  const origami = Boolean(SR.diagram || SR.steps);
  return kit.serialPage(SR, {
    title: SR.title_zh,
    en: SR.title_en,
    meta: SR.by,
    done: origami && SR.photo ? `<div class="box done">${img(SR.photo, SR.photo_pos || "center")}<div class="lb fun">做好是这样</div><div class="credit3 en">${SR.photo_credit}</div></div>` : "",
    pic: !origami,
    body: SR.steps ? grid(SR) : SR.diagram ? diagram(SR) : tasks(SR),
  });
}
