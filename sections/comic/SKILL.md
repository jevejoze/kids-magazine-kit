# 今日一问（comic）

4 格漫画 + 一张图解，把封面问题的答案讲清楚：一个机制或证据链、一个可核实的数字、纠正一个常见误解。前两格开场，主图解释，后两格追问或验证。

## 开工

1. 领任务单：`node scripts/pipeline.mjs ticket <issue> comic`，照单上的规则、参数、角色槽位写；最后一行的指纹写进 `_meta.ticket`。任务单「上游值」里有 `cover.question`，封面问题一改，这一步就过期
2. 读任务书和 `issue/10-cover.json`（`answer` 是答案要点）
3. 写 `issue/11-comic.json` 和 `issue/11-diagram.svg`，字段见同目录 `schema.json`

```json
{
  "_meta": {"stage": "11-comic", "by": "", "at": "", "ticket": "<任务单指纹>"},
  "theme_icon": "🔢",
  "title_zh": "蜂巢里的数学：为什么是六边形？",
  "title_en": "Why are honeycomb cells hexagons?",
  "panels": [
    {"title": "先看现象", "bubbles": [{"who": "<asker>", "lang": "zh", "text": "……"}], "chars": ["<asker>:surprise:130"]},
    {"bubbles": [{"lang": "zh", "text": "……"}], "chars": ["<expert>:talk:130"]},
    {"bubbles": [{"lang": "zh", "text": "……"}, {"lang": "zh", "text": "……"}], "chars": ["<asker>:think:110", "<expert>:happy:110"]},
    {"bubbles": [{"lang": "en", "text": "……"}, {"lang": "zh", "text": "……"}], "chars": ["<english>:happy:110", "<asker>:happy:110"]}
  ],
  "diagram": "11-diagram.svg",
  "diagram_title": "告诉孩子跟着哪条线、哪个点或哪组对比看",
  "takeaway": "用一句话直接回答封面问题",
  "fact_title": "💡 再发现",
  "fact": "紧扣主问题的可查证延伸",
  "host": "主持：asker × expert 的角色名",
  "sources": ["核实数字和冷知识的资料链接"]
}
```

`who`、`chars` 里写具体角色代号（任务单「角色槽位」查槽位由谁担），上面的 `<槽位>` 只是占位。

## 规则

- 4 格：提问 → 原理 → 追问一层"那为什么……" → 验证或收尾。版面按前两格 → 主图 → 后两格排列。english 槽位的角色用英文复述关键点，不用无关笑话代替解释
- 追问必须被直接回答，不能用另一个季节、地点或数字搪塞；历史/考古题讲清证据来源，区分事实与古人的信仰，不硬套物理机制
- `panels[].title` 可选，≤ 12 字，写具体场景；`diagram_title` ≤ 28 字，指向图中具体观察点；`takeaway` ≤ 28 字，保持一行，不新增未经解释的结论。这些字段省略时旧稿仍可渲染
- 每格单人对白硬上限 26 字，双人每句硬上限 20 字（中英文均按实际显示字符计数）；一格最多 2 个气泡。一格 1 个角色时尺寸 130，2 个时各 110，模板按 spec 显示，漫画格角色尺寸硬上限 130px（包括 `who` 中的 spec）；用 `who` 标明说话者。气泡只写纯文本，不使用 HTML 标签；数学符号 `<`、`>` 按字符计数并显示为文字，中文按词组换行
- `fact` ≤ 45 字，必须可查证、紧扣主问题。延伸只讲同一机制或证据链的新角度。`fact_title` 可选，≤ 8 字
- 图解 SVG：`viewBox="0 0 880 300"`，字体写 `font-family="ZCOOL KuaiLe, PingFang SC, sans-serif"`，中文标注 ≥ 24 号字（推荐 28 以上），把机制画出来，可以为看清适度夸张比例；颜色用 `#4A3B32`（墨色）、`#FFE27A`（黄）、`#FF8A7A`（红）、`#7FD3BC`（绿）、`#8EC5FF`（蓝）；不引用外部网络图片
- 主图按实际剩余空间在 200–280px 间调整。关键路线、点或结构太小时加放大窗；连接线不能暗示错误的物理路径
- 字数通过不等于排版通过：渲染仍会检查页脚、正文重叠与文字越界；即使草稿模式也不会发布溢出的成品

## 自检

`node scripts/pipeline.mjs check <issue>` 没有 `[11]` 报错；数字自己算一遍或在 `sources` 里能查到；关键事实优先引用官方机构、博物馆或原始研究；SVG 能在浏览器打开、文字不出界；图中轨迹、光线、标签要互相一致，简化示意明确说明；按实际页面检查角色、气泡和图解没有裁切或重叠。
