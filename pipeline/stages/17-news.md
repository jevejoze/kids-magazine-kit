# 17 环球小报

**目标**：3 条最近 7 天适合孩子的真实新闻，1 条头条 + 2 条短讯。

**读**：`issue/00-brief.json`、`data/profile.md`（兴趣）

**写**：`issue/17-news.json`

```json
{
  "_meta": {"stage": "17-news", "by": "", "at": ""},
  "week": "10.06–10.12",
  "items": [
    {"flag": "🇪🇸", "place": "西班牙 · 巴塞罗那", "title": "长颈鹿会做加法！", "text": "≤ 50 字",
     "word": {"en": "count", "zh": "数数"},
     "photo_url": "原图直链", "photo_credit": "摄影师 / 来源", "photo_pos": "center 30%",
     "sources": ["报道链接", "另一个独立来源"]}
  ],
  "ask_zh": "你怎么看？……", "ask_en": "……?",
  "credits": "来源：…… 照片：……",
  "foot": "新闻来源已交叉核实 · 明天见！See you tomorrow!"
}
```

**规则**
- 来源：News for Kids、Science News Explores、DOGOnews、Time for Kids、BBC Newsround、NASA 等儿童新闻或科学媒体
- 每条至少再找 1 个独立来源核实，两个链接都写进 `sources`
- 只选正向、好奇心向的新闻；政治、选举、抗议、灾难、暴力类一律跳过；不出现真实 IP 角色
- 有新闻原图就用原图（只在家里看），`photo_credit` 写清来源；找不到原图时用自由授权的同类照片，并在 `foot` 写"照片为示意"
- 选新闻时把"有没有好照片"当作条件之一；第 1 条是头条，照片要最好
- `text` ≤ 50 字；`ask_zh` 是一道需要说理由的"你怎么看"

**自检**：每条两个来源说法一致；日期在最近 7 天内（以报道日期为准，事件较早时在 `text` 里交代）
