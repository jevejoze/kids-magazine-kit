# 传说怪物档案（creature）

每周一（自然科学日）一张可收集的怪物卡，排在今日一问后面。一张卡讲一只传说怪物：传说里怎么说、科学家怎么说、它的真实原型是什么。编号从 No.001 往上排，孩子攒成一本档案。其他日子不出（任务书的 `creature` 为 `false`，领任务单会报"本期不出"）。

## 开工

1. 领任务单：`node scripts/pipeline.mjs ticket <issue> creature`，照单上的规则、参数、角色槽位写；最后一行的指纹写进 `_meta.ticket`
2. 读任务书、`data/profile.md`（兴趣）、任务单「要读、要更新的状态」里的档案：`data/state/creature/config.md`（选题偏好）和 `log.jsonl`（发过哪些、最后一个编号）；数据目录还没建 `state/creature/` 时是 `data/creature-log.md`
3. 写 `issue/09-creature.json`，字段见同目录 `schema.json`

```json
{
  "_meta": {"stage": "09-creature", "by": "", "at": "", "ticket": "<任务单指纹>"},
  "no": 1,
  "name_zh": "大海蛇",
  "parts": [{"en": "Sea", "zh": "海"}, {"en": "Serpent", "zh": "大蛇"}],
  "legend_url": "传说图直链",
  "legend_credit": "Hans Egede 1734 · 公有领域",
  "legend_pos": "center",
  "photo_url": "真身照片直链",
  "photo_credit": "Katia Cao · CC BY 3.0",
  "photo_pos": "center 45%",
  "tag": "🌊 浅海到 1000 米",
  "stats": [{"k": "传说身长", "v": "60 米"}, {"k": "真实原型", "v": "皇带鱼"}, {"k": "原型身长", "v": "最长 8 米"}],
  "meters": [{"label": "吓人", "n": 4, "icon": "😱"}, {"label": "真实", "n": 3, "icon": "🔍"}, {"label": "罕见", "n": 5, "icon": "💎"}],
  "boxes": [
    {"title": "📜 传说里说", "text": "≤ 60 字"},
    {"title": "🔬 科学家怎么说", "text": "≤ 60 字"},
    {"title": "🐟 真实原型", "text": "≤ 60 字"}
  ],
  "fast": "一定是真的大海蛇！",
  "slow": "先看看有没有被抓到过的标本？",
  "sources": ["博物馆或科研机构页面", "另一个独立来源"],
  "log_update": "No.001 大海蛇 → 皇带鱼"
}
```

## 规则

- 选题：按 `profile.md` 的兴趣挑；默认是海里的传说怪物（大海蛇、克拉肯、美人鱼、鲸鱼岛、海和尚……），每只都要有一个科学上说得清的真实原型（皇带鱼、大王乌贼、儒艮、鳗鱼……）。档案里发过的不重复
- `no` 接档案里最后一个编号 + 1
- `name_zh` ≤ 8 字；`parts` 把英文名拆成 1–3 个词，每个配中文意思（孩子顺便认词）
- **两张图并排**：左边「传说里的样子」，右边「可能的真身」，让孩子一眼比出传说把它夸张成了什么样。两张图来源不同，授权分别写清：
  - **传说图**（`legend_url`）：古人画的这只怪物，用公有领域的老版画、木刻、古地图或老博物书插图（如 Olaus Magnus 1539 年《海图》Carta Marina、Hans Egede 1734 年的大海蛇、Conrad Gesner 的《动物志》），在 Commons 上找；画里要看得出就是这只怪物。不用 AI 生成或现代人新画的图。`legend_credit` 写画家、年份和"公有领域"
  - **真身照片**（`photo_url`）：真实原型的自由授权实拍照片（Commons、NOAA、博物馆开放图库），一眼看得出是什么动物；`photo_credit` 写作者和协议
- `tag` 一句栖息地或深度（≤ 12 字）；`stats` 3 格，固定一格写传说里的数字、一格写原型、一格写原型的真实数字
- `meters` 2–3 条打分（1–5），吓人程度、真实程度、罕见程度，或者换成和这只怪物有关的维度
- `boxes` 3 格，顺序固定：传说里说 → 科学家怎么说 → 真实原型，各 ≤ 60 字。"科学家怎么说"讲人们是**怎么查出来的**（标本、照片、目击误认），让孩子看到证据怎么推翻传说
- `fast`、`slow` 各 ≤ 24 字：asker 的快脑袋一下子信了，expert 的慢脑袋提一个查证的问题，和「真的假的」用同一套说法
- 传说里吞船、吃人这类情节一句带过，写成好笑或神秘的样子；不写血腥、恐怖画面
- `sources` 至少 2 个独立来源，科学事实都要查得到；`log_update` 是第 90 步写进档案的一句

## 图片

两张图放 `20-assets/creature/`：

```sh
node sections/creature/fetch.mjs <issue>                       # 用 09-creature.json 的 legend_url、photo_url
node sections/creature/fetch.mjs <issue> <传说图直链> <照片直链>  # 直链另给
```

脚本打印出 `assets.json` 要写的两项（`creature`、`creature_legend`，路径带 `creature/`），照抄进去。

## 自检

`node scripts/pipeline.mjs check <issue>` 没有 `[09]` 报错；编号接得上；传说图是公有领域老图、画的是这只怪物；照片拍的是原型、授权写清；`stats` 和 `boxes` 里的数字和来源一致。
