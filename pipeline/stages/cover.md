# 10 封面选题

封面已经是栏目包，写稿规则全在 `sections/cover/SKILL.md`，照它做。

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> cover`，照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**读**：`issue/brief.json`、`data/profile.md`（兴趣权重）、最近几期的 `cover.json`（避免重复）

**写**：`issue/cover.json`

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[cover]` 报错；答案能在 `sources` 里查到；渲染后主体没被刊名、问题、角色挡住
