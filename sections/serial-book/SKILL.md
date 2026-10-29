# 经典连载 · 书（serial-book）

信箱前面的一页，平时连载一本公版经典儿童书：一期讲一回，停在悬念上，让孩子明天还想翻开。页位是 `serial`，本期 `kind` 是 `book` 时由这个包出。

## 开工

1. 领任务单：`node scripts/pipeline.mjs ticket <issue> serial`（或 `serial-book`），照单上的规则、参数、角色槽位写；最后一行的指纹写进 `_meta.ticket`。本期 kind 不是 book 时任务单会报错，告诉你该领哪个包
2. 读任务书的 `serial` 块和任务单「要读、要更新的状态」里的文件：
   - `state/serial-book/config.md`：家长写的书目、分集计划、角色认领（哪位编辑部成员认领哪个书中角色）、连载由谁念
   - `state/serial-book/log.jsonl`：讲过的各回，一回一行
   - 数据目录还没有 `state/serial-book/` 时，这些都在旧档案 `serial-bible.md` 里
3. 读 `profile.md` 的英文档位，写 `issue/18-serial.json`，字段见同目录 `schema.json`

```json
{
  "_meta": {"stage": "18-serial", "by": "", "at": "", "ticket": "<任务单指纹>"},
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
  "summary": "一句话：这一回讲到哪、埋了什么悬念，归档写进 log.jsonl"
}
```

## 规则

- 按分集计划讲当期这一回；一回 ≤ 280 字，2–4 段，可以用 `<em>…</em>` 标出关键物件
- 用自己的话从英文原著改写；书里的事件、人物、顺序照原著，不加原著没有的情节。现有的中文译本有版权，不照抄
- 改写给 9 岁孩子读：短句、具体的动作和声音，少写风景描写；每回停在一个悬念上
- `quote` 摘一句原著英文原文（照抄，核对标点），≤ 25 个词，按当前英文档位挑看得懂的；`zh` 是自己译的意思
- `crew`：认领了本回主角的那位编辑部成员吐槽一句（≤ 20 字），表情贴合剧情
- `guess` 是"你猜接下来会怎样"，下一回开头自然揭晓（信箱不再回应）；`tbc` 预告下一回，只给一个悬念
- 插画：优先用 Wikimedia Commons 上的公版原版插画（如 Paul Bransom 1913 版彩图、1908 年初版卷首画），画面要对得上本回情节；同一张插画可以在情节对得上的几回里重复用。找不到对得上的就用最接近的一张，在 `_meta.issues` 写明。这个包只用自由授权的图（`image_policy: free-only`）

## 图片

第 20 步把 `photo_url` 下载成 `20-assets/serial-book/serial.jpg`（`node scripts/assets.mjs fetch <url> <issue>/20-assets/serial-book/serial.jpg --min 800 --max 1600`），`assets.json` 的 `serial` 写 `serial-book/serial.jpg`。旧期的 `20-assets/serial.jpg` 照旧能用。

## 状态

本步只写 `18-serial.json`。第 90 步归档时：有 `state/serial-book/` 就把 `summary` 追加进 `log.jsonl`；旧数据目录照旧写 `bible_update`（追加到 `serial-bible.md`「进度」的一行），归档追加进 `serial-bible.md`。

## 自检

`node scripts/pipeline.mjs check <issue>` 没有 `[18]` 报错；字数；`quote` 和原著逐字一致；本回情节和分集计划对得上；插画对得上情节；没有照抄中文译本。
