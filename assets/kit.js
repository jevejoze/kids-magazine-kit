// 栏目共用的版式工具，旧模板和各栏目的 page.js 都用它：render(data, kit)
// 页码按调用 foot() 的先后计数，所以栏目要按页序渲染；总页数先写占位 {{TOTAL}}，全部渲染完再替换
const makeKit = D => {
  const N = String(D.issue).padStart(3, "0");
  const ch = spec => { const [n, m = "normal", s = 180, p = ""] = spec.split(":"); return draw(n, m, +s, p); };
  const bub = b => `<div class="bub ${b.lang === "en" ? "en" : "fun"}">${b.text}</div>`;
  const topBar = (tag, right) => `<div class="dots"></div><div class="top"><span class="tag fun">${tag}</span><span class="en">${right ?? N}</span></div>`;
  let pg = 0;
  const foot = left => `<div class="foot"><span class="fun">${left}</span><span class="page en">${++pg} / {{TOTAL}}</span></div>`;
  // 页脚的"往后翻"提示：指向下一页；后面没有页了就是空串
  const NEXT = name => { const t = TOC.map(x => x[1]), nx = t[t.indexOf(name) + 1]; return nx ? ` · 往后翻：${nx} →` : ""; };
  const coverFoot = left => `<div class="foot"><span class="fun">${left}</span></div>`;
  // 目录 = 本期实际有的页，顺序和页序一致：今日一问 → (怪物档案) → (单词屋) → 小剧场 → 挑战 → 环球小报 → 真的假的 → 连载 → 信箱
  const SERIAL = { book: ["📚", "经典连载", "Story Classics"], music: ["🎵", "音乐盒", "Music Box"], film: ["🎬", "放映室", "Movie Time"], make: ["✂️", "动手做", "Make It"] }[D.serial?.kind];
  const TOC = [["🤔", "今日一问"], D.creature && ["🐙", "怪物档案"], D.words && ["🔤", "单词屋"], ["📖", "小剧场"], ["🧩", "挑战"], D.news && ["🌏", "环球小报"], D.check && ["🕵️", "真的假的"], SERIAL?.slice(0, 2), D.think && ["🗣️", "周末思辨"], D.mailbox && ["💌", "信箱"]].filter(Boolean);
  const GANG = ["owl:happy:230", "dog:happy:290", "mouse:wave:260", "raccoon:smirk:220"];
  // Keep Chinese words and number/unit phrases together while respecting editorial <br> breaks.
  const chineseSegmenter = new Intl.Segmenter("zh", { granularity: "word" });
  const escapeText = text => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const numberUnitPhrase = /((?:\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千万亿]+)\s*(?:公斤|千克|千米|公里|厘米|毫米|小时|分钟|点半|点|吨|米|度|岁|天|秒|年|月|日|个))/g;
  const wrapChineseWords = (text, allowBreaks = true) => (allowBreaks ? String(text).split(/<br\s*\/?>/i) : [String(text)]).map(line => {
    const words = [];
    line.split(numberUnitPhrase).flatMap((part, i) => i % 2 ? [part] : [...chineseSegmenter.segment(part)].map(x => x.segment)).forEach(word => {
      if (/^[，。！？、：；,.!?…）】》]+$/.test(word) && words.length) words[words.length - 1] += word;
      else words.push(word);
    });
    return words.map(word => /^\s+$/.test(word) ? word : `<span class="word-group">${escapeText(word)}</span>`).join("");
  }).join("<br>");
  return {
    issue: D, N, ch, bub, topBar, foot, coverFoot, next: NEXT, toc: TOC, serial: SERIAL, cast: GANG, draw,
    escapeText, wrapChineseWords, pages: () => pg,
  };
};
