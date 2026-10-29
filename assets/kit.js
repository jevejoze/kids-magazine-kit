// 栏目共用的版式工具，旧模板和各栏目的 page.js 都用它：render(data, kit)
// 页码按调用 foot() 的先后计数，所以栏目要按页序渲染；总页数先写占位 {{TOTAL}}，全部渲染完再替换
const makeKit = (D, CAST) => {
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
  // 槽位 → 角色：栏目按槽位（asker、expert、english、trickster）找角色，名字和别名都算提到了他
  const slots = CAST?.slots ?? {};
  const mentions = (text, slot) => { const c = CAST?.characters?.[slots[slot]]; return !!c && [c.name, ...(c.aliases ?? [])].some(n => String(text).includes(n)); };
  // 经典连载四个栏目包（书、音乐盒、放映室、动手做）共用的版式：顶栏 → 标题 → 出处 → 完成图（可选）→ 正文（带配图）→ 本栏自己的块 → 成员吐槽和下回预告 → 页脚
  const serialPage = (SR, { right, title, en, meta, done = "", pic = true, body }) => `${topBar(`${SERIAL[0]} ${SERIAL[1]} · ${SERIAL[2]}`, right)}
  <div class="h1 fun">${title}<span class="en">${en}</span></div>
  <div class="meta fun">${meta}</div>
  ${done}
  <div class="text">${pic ? `<div class="box pic"><div class="img" style="background-image:url('${SR.photo}');background-position:${SR.photo_pos || "center"}"></div><div class="credit3 en">${SR.photo_credit}</div></div>` : ""}
    ${SR.paragraphs.map(p => `<p>${p}</p>`).join("")}</div>
  ${body}
  <div class="end"><div class="crew">${ch(SR.crew.who)}<div class="bub fun">${SR.crew.say}</div></div>
    <div class="next fun">${SR.guess ? `<span class="guess">🔮 猜一猜：${SR.guess}</span>` : ""}<span>${SR.tbc}</span></div></div>
  ${foot(SR.foot || NEXT(SERIAL[1]).replace(/^ · /, "") || "明天见！See you tomorrow!")}`;
  return {
    issue: D, N, ch, bub, topBar, foot, coverFoot, next: NEXT, toc: TOC, serial: SERIAL, serialPage, cast: GANG, slots, mentions, draw,
    escapeText, wrapChineseWords, pages: () => pg,
  };
};
