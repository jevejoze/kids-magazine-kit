# 经典连载 · 书（serial-book）

信箱前面的一页。告别平铺直叙按章摘抄（像语文阅读理解），全面重构为**名著高能刺激片段 + 周五脑洞大辩论**，带给孩子情绪过山车般的沉浸感与强烈的表达欲爆发。页位是 `serial`，本期 `kind` 是 `book` 时由这个包出。

连载书目：继续连载公版经典文学名著《柳林风声》（*The Wind in the Willows*，Kenneth Grahame 著）。

- **平时（周一至周四）**：精选生死动作与戏剧高潮，精准截断在最紧张的刹那（Cliffhanger 悬崖边缘）。
- **周五**：切换为“死党脑洞大辩论”，点燃周末表达欲！

## 开工

1. 领任务单：`node scripts/pipeline.mjs ticket <issue> serial`（或 `serial-book`），照单上的规则、参数、角色槽位写；最后一行的指纹写进 `_meta.ticket`。本期 kind 不是 book 时任务单会报错，告诉你该领哪个包
2. 读任务书的 `serial` 块和任务单「要读、要更新的状态」里的文件：
   - `state/serial-book/config.md`：家长写的书目、分集计划、角色认领（哪位编辑部成员认领哪个书中角色）、连载由谁念
   - `state/serial-book/log.jsonl`：讲过的各回，一回一行
   - 数据目录还没有 `state/serial-book/` 时，这些都在旧档案 `serial-bible.md` 里
3. 读 `profile.md` 的英文档位，写 `issue/serial.json`，字段见同目录 `schema.json`

### 平时高能连载示例（《柳林风声》生死截断）

```json
{
  "_meta": {"stage": "serial", "by": "编辑部", "at": "", "ticket": "<任务单指纹>"},
  "kind": "book",
  "ep": 3,
  "book_zh": "柳林风声", "book_en": "The Wind in the Willows", "author": "Kenneth Grahame · 1908",
  "chapter": "第 2 章 · 逍遥客车 The Open Road",
  "title_zh": "蛤蟆偷车狂飙", "title_en": "Toad's Wild Ride",
  "photo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Wind_in_the_Willows_p120.jpg/800px-Wind_in_the_Willows_p120.jpg",
  "photo_credit": "Paul Bransom, 1913 · Public domain", "photo_pos": "center 35%",
  "paragraphs": [
    "蛤蟆两眼放光，一把抓住方向盘，狠狠踩下了油门！华丽的红色跑车发出一声野兽般的怒吼，像一道闪电般冲上大路。",
    "“嘟——嘟——嘟！”蛤蟆疯狂按着喇叭，吓得路边的绵羊四处乱窜。车速越来越快，仪表盘的指针直接飙到了红线！",
    "前方的急转弯到了，迎面竟横停着一辆装满石头的重型马车！蛤蟆拼命猛打方向盘，车轮在石子路面上拉出刺耳的尖叫，整辆车腾空飞出了悬崖护栏——"
  ],
  "quote": {"en": "The poetry of motion! The real way to travel! The only way to travel!", "zh": "这才是速度的诗篇！这才是真正的旅行方式！", "who": "蛤蟆"},
  "crew": {"who": "dog:panic:130", "say": "刹车！快踩刹车啊！要撞上啦！"},
  "guess": "跑车腾空飞出悬崖，蛤蟆能侥幸逃生吗？",
  "tbc": "下一回：大闹法庭与二十年重刑",
  "summary": "蛤蟆偷车在公路上疯狂飙车，在急转弯处避让马车冲下悬崖，悬念停留在汽车腾空飞出的刹那。"
}
```

### 周五死党脑洞大辩论示例

```json
{
  "_meta": {"stage": "serial", "by": "编辑部", "at": "", "ticket": "<任务单指纹>"},
  "kind": "book",
  "ep": 5,
  "book_zh": "柳林风声", "book_en": "The Wind in the Willows", "author": "Kenneth Grahame · 1908",
  "chapter": "周末特别篇 · 死党脑洞大辩论",
  "title_zh": "死党脑洞辩论：隐身术还是会飞？", "title_en": "Invisibility vs. Flight",
  "photo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Wind_in_the_Willows_p042.jpg/800px-Wind_in_the_Willows_p042.jpg",
  "photo_credit": "Paul Bransom, 1913 · Public domain", "photo_pos": "center 20%",
  "paragraphs": [
    "周五脑洞大爆发！如果神仙给你一种终极超能力，你选【隐身术】还是【会飞】？编辑部已经吵翻天了！",
    "【正方·隐身派】3条扎心理由：① 捉迷藏称霸全宇宙，谁也抓不住；② 恶作剧不留痕迹，随时围观死党糗事；③ 遇到危险原地隐身，完美保命！",
    "【反方·飞行派】3条硬核理由：① 永远告别早高峰堵车，直冲云霄吹风；② 天空视角俯瞰大地，谁还要走路；③ 隐身可能被踩脚被撞翻，飞在天上才最自由！"
  ],
  "quote": {"en": "There is nothing — absolutely nothing — half so much worth doing as simply messing about in boats.", "zh": "世界上没有任何事，比自由自在闲逛更值得去做了。", "who": "河鼠"},
  "crew": {"who": "owl:smirk:130", "say": "我选飞！站在树梢看你们隐身互踩脚！"},
  "guess": "如果是你，你选隐身术还是会飞？快找爸妈辩论一场！",
  "tbc": "下一回：河鼠与鼹鼠勇闯凶险野树林",
  "summary": "周五死党脑洞大辩论：隐身术 vs 会飞，列举双方硬核扎心理由，激发孩子周末表达欲。"
}
```

## 规则

### 1. 章节节选原则（平时连载）
- **严禁平淡过渡段落**：绝不机械按章摘抄，严禁平铺直叙的背景交代、冗长的景物描写或平静的喝茶闲聊。
- **必须截取高能冲突与生死动作**：必须聚焦强戏剧冲突、冒险脱险、极致笑点或命悬一线的动作场面（如蛤蟆大闹法庭/偷车狂飙、大乌贼缠住潜艇、水鼠与鼹鼠雪夜勇闯野树林被怪影包围等），让情绪像过山车一样飙升。
- **结尾必须留在悬崖边缘（Cliffhanger）**：每一回必须精准掐断在最紧张、最危急、心跳最快的刹那（汽车腾空、怪爪伸来、法官惊堂木落下前一秒），**严禁在当期提前化解危险或交代结局**，让悬念抓心挠肝，逼得孩子迫不及待想看下一期！
- **篇幅与文字**：一回 ≤ 280 字，2–4 段。改写给 9 岁孩子：短句为主、动作具体、声音生动、动词有力，可用 `<em>…</em>` 突出关键动势。用自己的话从英文原著改写，人物与主线忠于原著，不照抄有版权的中文旧译本。

### 2. 周五脑洞大辩论规则
- **定位**：周五连载切换为“死党脑洞大辩论”，点燃周末表达欲与辩论热情。
- **辩题设计**：必须是极具吸引力、能引发强烈表达欲与争吵的荒诞/超能力两难抉择（如“隐身术 vs 会飞”、“读心术 vs 预知未来”、“变成巨型霸王龙 vs 变成不灭小跳蚤”等）。
- **论点论据**：辩论双方各列 **3 条硬核扎心理由**，势均力敌、切中痛点，拒绝空洞说教，不设标准答案。
- **发问号召**：`guess` 抛出站队发问，号召孩子在周末找爸妈或朋友展开硬核辩论。

### 3. 角色认领与吐槽规范
- **平时连载**：由编辑部成员认领书中核心角色（如波波鼠认领水鼠、团子狗认领鼹鼠/蛤蟆等，见 `config.md` 角色认领表）。
  - 书中角色的对白由认领他的成员演绎；
  - `crew.who` 由认领该角色的成员吐槽一句（≤ 20 字），表情和动作贴合剧情的高能惊险氛围（如 `panic`、`surprise`、`cry`）。
- **周五辩论**：编辑部死党角色各选一边站队陈词；`crew` 由其中一位成员发表扎心神补刀或终极拷问，挑动孩子表态。

### 4. 金句、发问与配图
- `quote`：摘一句原著英文原文（照抄，核对标点），≤ 25 个词，挑符合当前场景情绪高潮的句子；`zh` 是地道的中文翻译。
- `guess`：平时是悬念截断发问（“……他能逃出生天吗？”），周五是辩论站队发问（“……你选哪一边？各列3条理由！”），必须以问号结尾。
- `tbc`：预告下一回，只给核心悬念。
- 插画：优先用 Wikimedia Commons 上的公版原版插画（如 Paul Bransom 1913 版彩图、1908 年初版卷首画），画面必须紧扣当期的高能场面。只用自由授权的图（`image_policy: free-only`）。

## 图片

assets 这一步把 `photo_url` 下载成 `assets/serial-book/serial.jpg`（`node scripts/assets.mjs fetch <url> <issue>/assets/serial-book/serial.jpg --min 800 --max 1600`），`assets.json` 的 `serial` 写 `serial-book/serial.jpg`。旧期的 `assets/serial.jpg` 照旧能用。

## 状态

本步只写 `serial.json`。archive 这一步归档时：有 `state/serial-book/` 就把 `summary` 追加进 `log.jsonl`；旧数据目录照旧写 `bible_update`（追加到 `serial-bible.md`「进度」的一行），归档追加进 `serial-bible.md`。

## 自检

`node scripts/pipeline.mjs check <issue>` 没有 `[serial]` 报错；字数；`quote` 和原著逐字一致；本回情节和分集计划对得上；插画对得上高能情节；没有照抄中文译本。
