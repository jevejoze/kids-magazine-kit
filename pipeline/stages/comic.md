# 11 今日一问（4 格漫画 + 图解）

今日一问已经是栏目包，写稿规则全在 `sections/comic/SKILL.md`，照它做。

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> comic`，照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**读**：`issue/brief.json`、`issue/cover.json`

**写**：`issue/comic.json` 和 `issue/diagram.svg`

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[comic]` 报错；数字能在 `sources` 里查到；按实际页面检查角色、气泡和图解没有裁切或重叠
