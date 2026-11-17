// 经典连载 · 书：一期一回，正文左边是公版原版插画，下面一句原著英文金句
// 标题下面印一句上回前情（recap）；章节和作者挪到插画署名那一行。旧期没有 recap，标题下照旧印章节和作者
export function render(SR, kit) {
  const en = /^[“"]/.test(SR.quote.en) ? SR.quote.en : `“${SR.quote.en}”`;
  const source = [SR.chapter, SR.author].filter(Boolean);
  const recap = SR.recap ? String(SR.recap).replace(/^上回[：:]\s*/, "") : "";
  return kit.serialPage(SR, {
    right: `第 ${SR.ep} 回`,
    title: `《${SR.book_zh}》${SR.title_zh}`,
    en: `${SR.book_en} · ${SR.title_en}`,
    meta: recap ? `上回：${recap}` : source.join("　·　"),
    credit: recap ? source : [],
    body: `<div class="box quote"><div class="lb fun">📜 原著金句 · ${SR.quote.who}</div><div class="en">${en}</div><div class="zh fun">${SR.quote.zh}</div></div>`,
  });
}
