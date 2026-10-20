# 18 经典连载

**目标**：杂志最后一页。平时连载一本经典儿童书，一期讲一段，停在悬念上，让孩子明天还想翻开；周五（艺术日）换成「音乐盒」或「放映室」，介绍一首曲子或一部电影。

**读**：`issue/00-brief.json`（`serial`）、`data/serial-bible.md`（书目、分集计划、角色认领、已讲到哪、周五片单）、`data/profile.md`（英文档位）

**写**：`issue/18-serial.json`

书（`kind: "book"`）：

```json
{
  "_meta": {"stage": "18-serial", "by": "", "at": ""},
  "kind": "book",
  "ep": 3,
  "book_zh": "柳林风声", "book_en": "The Wind in the Willows", "author": "Kenneth Grahame · 1908",
  "chapter": "第 1 章 · 河岸 The River Bank",
  "title_zh": "鼹鼠翻船了", "title_en": "Mole Takes the Oars",
  "photo_url": "插画原图直链", "photo_credit": "Paul Bransom, 1913 · Public domain", "photo_pos": "center 40%",
  "paragraphs": ["……", "……"],
  "quote": {"en": "Believe me, my young friend, there is nothing — absolutely nothing — half so much worth doing as simply messing about in boats.", "zh": "相信我，没有什么事比在船上闲逛更值得做了。", "who": "河鼠"},
  "crew": {"who": "dog:surprise:130", "say": "我也想去野餐！带上蜂蜜饼干！"},
  "guess": "鼹鼠掉进河里了，河鼠会怎么做？",
  "tbc": "下一回：鼹鼠搬进河鼠家",
  "bible_update": "追加到 serial-bible.md「进度」的一行：第几回讲到哪、埋了什么悬念"
}
```

周五音乐盒（`kind: "music"`）/ 放映室（`kind: "film"`）：

```json
{
  "_meta": {"stage": "18-serial", "by": "", "at": ""},
  "kind": "music",
  "title_zh": "彼得与狼", "title_en": "Peter and the Wolf",
  "by": "普罗科菲耶夫 Prokofiev · 1936 · 约 25 分钟",
  "photo_url": "……", "photo_credit": "……", "photo_pos": "center",
  "paragraphs": ["……"],
  "tasks": ["小鸟出场时是什么乐器在吹？", "猫走路的音乐，是快还是慢？", "狼出场时，你听到几支圆号？"],
  "crew": {"who": "mouse:happy:130", "say": "In London, I saw it live!"},
  "where": "给家长：找一版带旁白的录音，B 站、QQ 音乐都有",
  "tbc": "下周五：放映室",
  "bible_update": "追加到 serial-bible.md「周五片单」的一行"
}
```

**书页规则**
- 按 `serial-bible.md` 的分集计划讲当期这一回；一回 ≤ 280 字，2–4 段，可以用 `<em>…</em>` 标出关键物件
- 用自己的话从英文原著改写；书里的事件、人物、顺序照原著，不加原著没有的情节。现有的中文译本有版权，不照抄
- 改写给 9 岁孩子读：短句、具体的动作和声音，少写风景描写；每回停在一个悬念上
- `quote` 摘一句原著英文原文（照抄，核对标点），≤ 25 个词，按当前英文档位挑看得懂的；`zh` 是自己译的意思
- `crew`：在 `serial-bible.md`「角色认领」里认领了本回主角的那位编辑部成员，吐槽一句（≤ 20 字），表情贴合剧情
- `guess` 是"你猜接下来会怎样"，下一期信箱回应孩子的猜测；`tbc` 预告下一回，只给一个悬念
- 插画：优先用 Wikimedia Commons 上的公版原版插画（Paul Bransom 1913 版彩图、1908 年初版卷首画等，搜 `Wind in the Willows Bransom` 或 `Wind in the Willows pg`），画面要对得上本回情节；同一张插画可以在情节对得上的几回里重复用。找不到对得上的就用最接近的一张，在 `_meta.issues` 写明

**周五规则**
- 音乐盒和放映室隔周轮换，按 `serial-bible.md`「周五片单」的顺序；优先和正在连载的书呼应
- `paragraphs` ≤ 180 字：这是什么、讲了什么或描绘了什么、为什么值得听/看；不剧透电影结局
- `tasks` 3 个边听边找或看完回答的小任务，要具体（哪个乐器、第几分钟、哪个角色做了什么）
- 歌词、台词只介绍，不转载；电影配图用官方剧照或海报（和新闻原图一样只放在私有数据目录），`photo_credit` 写清来源
- `where` 写给家长：去哪里找、选哪个版本、多长；电影注明年龄分级

**自检**：字数；`quote` 和原著逐字一致；本回情节和分集计划对得上；插画对得上情节；没有照抄中文译本
