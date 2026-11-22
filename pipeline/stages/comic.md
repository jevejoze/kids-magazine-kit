# 11 今日一问（4 格漫画 + 图解）

今日一问已经是栏目包，写稿规则全在 `sections/comic/SKILL.md`，照它做。

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> comic`。任务单会带上 cover 选题卡全文（含 `mechanism`、`number`、`misconception`）与「近期用过」清单。照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**读**：`issue/brief.json`（特别是 `brief.plan.cover` 选题卡）、`issue/cover.json`

**写**：`issue/comic.json` 和 `issue/diagram.svg`

**照卡写要求**：
- 紧扣 cover 选题卡展开，漫画和图解必须讲清卡片的 `mechanism`，包含确凿数字 `number`，纠正 `misconception`。
- 封面若因 fallback 换卡，今日一问同步重做。

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[comic]` 报错；数字能在 `sources` 里查到；按实际页面检查角色、气泡和图解没有裁切或重叠
