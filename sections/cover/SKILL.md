# 封面（cover）

选一个反直觉的问题和一张能证明它的真实照片。封面决定孩子要不要往下翻，是全期最重要的一页。

## 开工

1. 领任务单：`node scripts/pipeline.mjs ticket <issue> cover`，照单上的规则、参数、角色槽位写；最后一行的指纹写进 `_meta.ticket`
2. 读任务书（`child_question`、`topic_hint`、`weekday_theme`）、`data/profile.md`（兴趣权重）、最近几期的 `10-cover.json`（避免重复）
3. 写 `issue/10-cover.json`，字段见同目录 `schema.json`

```json
{
  "_meta": {"stage": "10-cover", "by": "", "at": "", "ticket": "<任务单指纹>"},
  "question": {"zh": "蜜蜂没学过数学，<br>为啥把格子造成六边形？", "en": "Why do bees build their cells as hexagons?"},
  "answer": "答案要点：六边形最省蜂蜡，还能挤得一点缝都没有（今日一问照此讲）",
  "photo": {"url": "图片直链", "page": "图片所在页面", "author": "作者", "license": "CC BY-SA 4.0",
            "verified": "拍摄时间、地点从哪里核实的"},
  "photo_pos": "center",
  "stamp": "🔍 真实蜂巢特写",
  "asked_by": "",
  "strip": "",
  "crew": ["<asker>:happy:190", "<trickster>:smirk:150"],
  "crew_say": "我只关心蜂蜜！",
  "credit": "© 作者 · 协议",
  "theme_icon": "🔢",
  "sources": ["核实问题答案用到的资料链接"]
}
```

`crew` 里写具体角色代号（任务单「角色槽位」查槽位由谁担），上面的 `<槽位>` 只是占位。

## 规则

- 问题要反直觉，四年级学生答不上来；"猫为什么爱钻纸箱"这类一猜就中的太浅
- 封面只放**一个问题**，留给孩子自己猜；答案由今日一问讲出来，要点写进 `answer` 给今日一问用（comic 的任务单把 `cover.question` 当上游值，问题一改，今日一问就要重做）
- 照片一眼看懂、自带悬念。优先 Wikimedia Commons、NASA 等自由授权图库；数学、艺术题材用实物特写
- 版式：顶部是刊名条，照片从刊名条下方开始、顶端渐隐进去；问题压在照片左下，角色在右下。所以照片的**主体要落在中上部**，下方留给文字。用 `photo_pos` 调裁切（如 `"center 0%"` 显示照片最上面），塔顶、动物的眼睛这类关键部位要完整露出
- 刊名条颜色自动取照片顶部的颜色；取出来不好看时用 `strip` 指定（CSS 颜色，如 `"#F6E7C8"`），否则留空
- 问题 ≤ 24 字，太长可以用 `<br>` 在完整词组之间断行；数字和单位（如“十二点”“12 点”“2 吨”）不要拆开
- `stamp` 放在问题上方，和问题放在一起作为照片证据；只写核实过的信息（拍摄时间、地点），≤ 14 字，不占照片中上部主体的位置
- `crew` 最多 2 个角色，表情和道具跟主题挂钩；按 spec 中的 150–200px 尺寸显示并靠近底边，角色列宽自适应；`crew_say` ≤ 12 字、单行显示
- 孩子提的问题被采用时，`asked_by` 写孩子的称呼，封面会用 💡 图标和奶油黄底色醒目显示"本期问题由 XX 提出"

## 自检

`node scripts/pipeline.mjs check <issue>` 没有 `[10]` 报错；答案能在 `sources` 里查到；照片协议允许使用；渲染后看一眼封面，主体没被刊名、问题、角色挡住。
