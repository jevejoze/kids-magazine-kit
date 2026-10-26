# 11 今日一问（4 格漫画 + 图解）

**目标**：把封面问题的答案讲清楚：一个机制或证据链、一个可核实的数字、纠正一个常见误解。用前两格开场，让主图解释，再用后两格追问或验证。

**读**：`issue/00-brief.json`、`issue/10-cover.json`

**写**：`issue/11-comic.json` 和 `issue/11-diagram.svg`

```json
{
  "_meta": {"stage": "11-comic", "by": "", "at": ""},
  "theme_icon": "🔢",
  "title_zh": "蜂巢里的数学：为什么是六边形？",
  "title_en": "Why are honeycomb cells hexagons?",
  "panels": [
    {"title": "先看现象", "bubbles": [{"who": "dog", "lang": "zh", "text": "……"}], "chars": ["dog:surprise:130"]},
    {"bubbles": [{"lang": "zh", "text": "……"}], "chars": ["owl:talk:130"]},
    {"bubbles": [{"lang": "zh", "text": "……"}, {"lang": "zh", "text": "……"}], "chars": ["dog:think:110", "owl:happy:110"]},
    {"bubbles": [{"lang": "en", "text": "……"}, {"lang": "zh", "text": "……"}], "chars": ["mouse:happy:110", "dog:happy:110"]}
  ],
  "diagram": "11-diagram.svg",
  "diagram_title": "告诉孩子跟着哪条线、哪个点或哪组对比看",
  "takeaway": "用一句话直接回答封面问题",
  "fact_title": "💡 再发现",
  "fact": "紧扣主问题的可查证延伸",
  "host": "主持：团子狗 × 咕咕博士",
  "sources": ["核实数字和冷知识的资料链接"]
}
```

**规则**
- 4 格：提问 → 原理 → 追问一层"那为什么……" → 验证或收尾。版面按前两格 → 主图 → 后两格排列。波波鼠的英文用来复述关键点，不用无关笑话代替解释。
- 追问必须被直接回答，不能用另一个季节、地点或数字搪塞；历史/考古题讲清证据来源，区分事实与古人的信仰，不硬套物理机制。
- `panels[].title` 可选，≤ 12 字，写具体场景；`diagram_title` ≤ 28 字，指向图中具体观察点；`takeaway` ≤ 40 字，不新增未经解释的结论。这些字段省略时旧稿仍可渲染。
- 每个气泡 ≤ 30 字，建议单人对白 ≤ 26、双人每句 ≤ 20；一格最多 2 个气泡。一格 1 个角色时尺寸 130，2 个时各 110，模板按 spec 显示；用 `who` 标明说话者。中文为纯文本，模板按词组换行。
- `fact` ≤ 60 字，必须可查证、紧扣主问题。不要在讲极昼时突然插入养猫、北极熊等无关信息。`fact_title` 可选，≤ 8 字。
- 图解 SVG：`viewBox="0 0 880 300"`，字体写 `font-family="ZCOOL KuaiLe, PingFang SC, sans-serif"`，中文标注 ≥ 24 号字（推荐 28 以上），把机制画出来，可以为看清适度夸张比例；颜色用 `#4A3B32`（墨色）、`#FFE27A`（黄）、`#FF8A7A`（红）、`#7FD3BC`（绿）、`#8EC5FF`（蓝）

**自检**：数字自己算一遍或在 `sources` 里能查到；关键事实优先引用官方机构、博物馆或原始研究；SVG 能在浏览器打开、文字不出界；图中轨迹、光线、标签要互相一致，简化示意明确说明；按实际页面检查角色、气泡和图解没有裁切或重叠。
