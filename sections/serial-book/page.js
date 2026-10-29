// 经典连载 · 书：一期一回，正文左边是公版原版插画，下面一句原著英文金句
export function render(SR, kit) {
  const en = /^[“"]/.test(SR.quote.en) ? SR.quote.en : `“${SR.quote.en}”`;
  return kit.serialPage(SR, {
    right: `第 ${SR.ep} 回`,
    title: `《${SR.book_zh}》${SR.title_zh}`,
    en: `${SR.book_en} · ${SR.title_en}`,
    meta: `${SR.chapter}　·　${SR.author}`,
    body: `<div class="box quote"><div class="lb fun">📜 原著金句 · ${SR.quote.who}</div><div class="en">${en}</div><div class="zh fun">${SR.quote.zh}</div></div>`,
  });
}
