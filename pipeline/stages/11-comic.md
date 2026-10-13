# 11 今日一问（4 格漫画 + 图解）

**目标**：把封面问题的答案讲清楚：一个机制、一个具体数字、纠正一个常见误解。

**读**：`issue/00-brief.json`、`issue/10-cover.json`

**写**：`issue/11-comic.json` 和 `issue/11-diagram.svg`

```json
{
  "_meta": {"stage": "11-comic", "by": "", "at": ""},
  "theme_icon": "🔢",
  "title_zh": "蜂巢里的数学：为什么是六边形？",
  "title_en": "Why are honeycomb cells hexagons?",
  "panels": [
    {"bubbles": [{"lang": "zh", "text": "……"}], "chars": ["dog:surprise:130"]},
    {"bubbles": [{"lang": "zh", "text": "……"}], "chars": ["owl:talk:130"]},
    {"bubbles": [{"lang": "zh", "text": "……"}, {"lang": "zh", "text": "……"}], "chars": ["dog:think:110", "owl:happy:110"]},
    {"bubbles": [{"lang": "en", "text": "……"}, {"lang": "zh", "text": "……"}], "chars": ["mouse:happy:110", "dog:happy:110"]}
  ],
  "diagram": "11-diagram.svg",
  "fact": "可查证的延伸冷知识",
  "host": "主持：团子狗 × 咕咕博士",
  "sources": ["核实数字和冷知识的资料链接"]
}
```

**规则**
- 4 格：提问 → 原理 → 追问一层"那为什么……" → 收尾（波波鼠说一句英文，团子狗搞笑收尾）
- 每个气泡 ≤ 30 字；一格最多 2 个气泡；一格 1 个角色时尺寸 130，2 个时各 110
- `fact` ≤ 60 字，必须可查证
- 图解 SVG：`viewBox="0 0 880 300"`，字体写 `font-family="ZCOOL KuaiLe, PingFang SC, sans-serif"`，中文标注 ≥ 24 号字，把机制画出来，可以为看清适度夸张比例；颜色用 `#4A3B32`（墨色）、`#FFE27A`（黄）、`#FF8A7A`（红）、`#7FD3BC`（绿）、`#8EC5FF`（蓝）

**自检**：数字自己算一遍或在 `sources` 里能查到；SVG 能在浏览器打开、文字不出界
