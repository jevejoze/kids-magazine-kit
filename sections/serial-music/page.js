// 音乐盒（周五）：介绍一首曲子，配 3 个边听边找的任务
export function render(SR, kit) {
  return kit.serialPage(SR, {
    title: SR.title_zh,
    en: SR.title_en,
    meta: SR.by,
    body: `<div class="box tasks fun"><div class="lb">🎧 边听边找</div>${SR.tasks.map((t, i) => `<p><b>${i + 1}</b>${t}</p>`).join("")}${SR.where ? `<small>${SR.where}</small>` : ""}</div>`,
  });
}
