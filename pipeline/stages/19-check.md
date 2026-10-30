# 19 真的假的

真的假的已经是栏目包，写稿、课表参数、归档规则全在 `sections/check/SKILL.md`，照它做。每天出。

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> check`，照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**读**：`issue/00-brief.json`（日期）、`data/thinking-plan.md`（可选）、`data/profile.md`、最近几期的 `issue/19-check.json`（避免重复）、任务单的 `skill`/`choices`/`tools` 参数

**写**：`issue/19-check.json`

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[19]` 报错；真假结论两个来源说法一致；3 条线索不剧透
