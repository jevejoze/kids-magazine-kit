# 18 经典连载

**目标**：信箱前面的一页。平时连载一本经典儿童书，一期讲一段，停在悬念上，让孩子明天还想翻开；周五（艺术日）换成「音乐盒」「放映室」或「动手做」，介绍一首曲子、一部电影，或者带孩子做一件折纸、打印一个 3D 模型。

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

周五动手做（`kind: "make"`），折纸或 3D 打印：

```json
{
  "_meta": {"stage": "18-serial", "by": "", "at": ""},
  "kind": "make",
  "title_zh": "会跳的纸青蛙", "title_en": "Jumping Paper Frog",
  "by": "折纸 · 难度 ⭐⭐ · 约 15 分钟 · 一张名片大小的硬纸",
  "photo_url": "成品照片直链", "photo_credit": "……", "photo_pos": "center",
  "paragraphs": ["……"],
  "tasks": ["纸横放，上边两个角往下折出 X 形折痕", "……"],
  "crew": {"who": "raccoon:smirk:130", "say": "比谁的青蛙跳得远！"},
  "where": "给家长：跟做视频搜「jumping frog origami」；名片或卡纸最好跳",
  "tbc": "下周五：音乐盒",
  "bible_update": "追加到 serial-bible.md「周五片单」的一行"
}
```

**书页规则**
- 按 `serial-bible.md` 的分集计划讲当期这一回；一回 ≤ 280 字，2–4 段，可以用 `<em>…</em>` 标出关键物件
- 用自己的话从英文原著改写；书里的事件、人物、顺序照原著，不加原著没有的情节。现有的中文译本有版权，不照抄
- 改写给 9 岁孩子读：短句、具体的动作和声音，少写风景描写；每回停在一个悬念上
- `quote` 摘一句原著英文原文（照抄，核对标点），≤ 25 个词，按当前英文档位挑看得懂的；`zh` 是自己译的意思
- `crew`：在 `serial-bible.md`「角色认领」里认领了本回主角的那位编辑部成员，吐槽一句（≤ 20 字），表情贴合剧情
- `guess` 是"你猜接下来会怎样"，下一回开头自然揭晓（信箱不再回应）；`tbc` 预告下一回，只给一个悬念
- 插画：优先用 Wikimedia Commons 上的公版原版插画（Paul Bransom 1913 版彩图、1908 年初版卷首画等，搜 `Wind in the Willows Bransom` 或 `Wind in the Willows pg`），画面要对得上本回情节；同一张插画可以在情节对得上的几回里重复用。找不到对得上的就用最接近的一张，在 `_meta.issues` 写明

**周五规则**
- 音乐盒、放映室、动手做按 `serial-bible.md`「周五片单」的顺序轮换；优先和正在连载的书或孩子的兴趣呼应
- `paragraphs` ≤ 180 字：这是什么、讲了什么或描绘了什么、为什么值得听/看；不剧透电影结局
- `tasks` 3 个边听边找或看完回答的小任务，要具体（哪个乐器、第几分钟、哪个角色做了什么）
- 歌词、台词只介绍，不转载；电影配图用官方剧照或海报（和新闻原图一样只放在私有数据目录），`photo_credit` 写清来源
- `where` 写给家长：去哪里找、选哪个版本、多长；电影注明年龄分级

**动手做规则**
- 一件作品，孩子自己 30 分钟内做得完（3D 打印的等待时间另算）；做好能玩、能摆或能用（会跳的青蛙、能动的关节龙），优先挑和孩子兴趣挂钩的（动物、海怪）
- `paragraphs` ≤ 120 字：这是什么、好玩在哪，再带一个背后的小知识（青蛙为什么能跳：纸的弹力）
- `tasks` 写 4–8 步，每步 ≤ 24 字，一步只做一个动作，用"上边""对角""折痕"这类孩子听得懂的词
- 折纸：挑 8 步以内能折完的经典款，`photo_url` 用自由授权的成品照片；`where` 给家长一个跟做视频的搜索词和纸张建议
- 3D 打印：只选 Printables、Thingiverse 上自由授权（CC）、允许个人打印的原创模型，不选真实 IP 角色；挑免支撑、单色 PLA、两小时内打完的；`photo_url` 用模型页的照片，`photo_credit` 写作者和协议；`by` 写打印时长；`where` 写模型链接和打印设置（材料、层高、要不要支撑），用模型页推荐的参数。打印机型号看 `profile.md`

**自检**：字数；`quote` 和原著逐字一致；本回情节和分集计划对得上；插画对得上情节；没有照抄中文译本
