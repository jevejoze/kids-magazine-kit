# 10 封面选题

**目标**：选一个反直觉的问题和一张能证明它的真实照片。封面决定孩子要不要往下翻，是全期最重要的一步。

**读**：`issue/00-brief.json`、`data/profile.md`（兴趣权重）、最近几期的 `10-cover.json`（避免重复）

**写**：`issue/10-cover.json`

```json
{
  "_meta": {"stage": "10-cover", "by": "", "at": ""},
  "question": {"zh": "蜜蜂没学过数学，为啥把格子造成六边形？", "en": "Why do bees build their cells as hexagons?",
               "options": ["六边形最省蜂蜡，还能挤得一点缝都没有", "蜜蜂的眼睛是六边形的，照着眼睛造", "蜂后拿着尺子一格一格量出来"]},
  "answer": "A（为什么对；B、C 为什么错）",
  "photo": {"url": "图片直链", "page": "图片所在页面", "author": "作者", "license": "CC BY-SA 4.0",
            "verified": "拍摄时间、地点从哪里核实的"},
  "photo_pos": "center",
  "stamp": "🔍 真实蜂巢特写",
  "kicker": "🤔 数一数每个格子有几条边，再猜一猜：",
  "crew": ["owl:think:150:magnifier", "dog:happy:190", "raccoon:smirk:150"],
  "crew_say": "我只关心蜂蜜！",
  "credit": "© 作者 · 协议",
  "theme_icon": "🔢",
  "sources": ["核实问题答案用到的资料链接"]
}
```

**规则**
- 问题要反直觉，四年级学生答不上来；"猫为什么爱钻纸箱"这类一猜就中的太浅
- 3 个选项：1 个正确、1 个常见误解、1 个搞笑；答案和理由写进 `answer`
- 照片铺满整页、一眼看懂、自带悬念。优先 Wikimedia Commons、NASA 等自由授权图库；数学、艺术题材用实物特写
- `stamp` 只写核实过的信息（拍摄时间、地点），≤ 14 字
- `crew` 2–3 个编辑部成员，表情和道具跟主题挂钩（写法见 SKILL.md「编辑部角色」）；`crew_say` ≤ 12 字
- 孩子提的问题被采用时，`kicker` 写"本期问题由 XX 提出"

**自检**：答案能在 `sources` 里查到；照片协议允许使用；问题 ≤ 22 字（封面一行放得下）
