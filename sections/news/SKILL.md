# 环球小报（news）

3 条最近 7 天适合孩子的真实新闻，1 条头条 + 2 条短讯。页面保持简短，讲读版靠 `talk` 讲得更丰富。

## 开工

1. 领任务单：`node scripts/pipeline.mjs ticket <issue> news`，照单上的规则、参数、角色槽位写；最后一行的指纹写进 `_meta.ticket`
2. 读任务书、`data/profile.md`（兴趣）
3. 写 `issue/news.json`，字段见同目录 `schema.json`

```json
{
  "_meta": {"stage": "news", "by": "", "at": "", "ticket": "<任务单指纹>"},
  "week": "10.06–10.12",
  "items": [
    {"flag": "🇪🇸", "place": "西班牙 · 巴塞罗那", "title": "长颈鹿会做加法！", "text": "≤ 50 字",
     "word": {"en": "count", "zh": "数数"},
     "photo_url": "原图直链", "photo_credit": "摄影师 / 来源", "photo_pos": "center 30%",
     "photo_shows": "一只长颈鹿把头伸向两块写着数字的板子",
     "talk": {"background": "研究人员在动物园里拿胡萝卜片测试长颈鹿……", "scale": "长颈鹿的脑子只有一个橙子那么大", "follow_up": "那别的动物会不会数数？"},
     "sources": ["报道链接", "另一个独立来源"]}
  ],
  "ask_zh": "你怎么看？……", "ask_en": "……?",
  "credits": "来源：…… 照片：……",
  "foot": ""
}
```

## 规则

- 来源：News for Kids、Science News Explores、DOGOnews、Time for Kids、BBC Newsround、NASA 等儿童新闻或科学媒体
- 每条至少再找 1 个独立来源核实，两个链接都写进 `sources`
- 只选正向、好奇心向的新闻；政治、选举、抗议、灾难、暴力类一律跳过；不出现真实 IP 角色
- 这个栏目用新闻原图（`image_policy: private-ok`），只能放在私有数据目录里，`photo_credit` 写清来源；全刊是 `free-only` 的杂志用不了这个栏目。找不到原图时用自由授权的同类照片，并在 `foot` 写"照片为示意"
- **照片要一眼看懂**：照片必须拍到新闻里真实的那个东西（那只动物、那枚火箭、那辆车、那座建筑），孩子不读文字也能说出"这是什么"。抽象、象征、示意类的图（一只钟、一个标志、一张图表、一张人像会议照）不要；没有这样的照片，就换一条新闻。`photo_shows` 用一句话写照片里实际拍到了什么
- 选新闻时把"有没有好照片"当作首要条件之一；第 1 条是头条，照片要最好
- 优先孩子的兴趣（看 `profile.md` 的兴趣权重）：动物、海洋、太空、能动手做的东西
- `talk` 给讲读版用，页面上不显示：`background` 2–3 句背景（谁、怎么发现的、过程里最有意思的细节）；`scale` 一个把数字变成孩子摸得着的类比（"相当于 3 辆校车那么长"）；`follow_up` 一个顺着往下想的追问。事实都要出自 `sources`
- `text` ≤ 50 字；`word` 按任务单的英文档位挑；`ask_zh` 是一道需要说理由的"你怎么看"
- `foot` 一般留空，模板会自动写"新闻来源已交叉核实 · 往后翻：下一页"；道别放在最后一页信箱

## 图片

3 张照片放 `assets/news/`：

```sh
node sections/news/fetch.mjs <issue>                    # 用每条的 photo_url
node sections/news/fetch.mjs <issue> <直链 1> <直链 2> <直链 3>
```

脚本打印出 `assets.json` 要写的 `news`（路径带 `news/`），照抄进去。

## 自检

`node scripts/pipeline.mjs check <issue>` 没有 `[news]` 报错；每条两个来源说法一致；只看照片能认出是什么；`talk` 的事实来源里查得到；日期在最近 7 天内（以报道日期为准，事件较早时在 `text` 里交代）。
