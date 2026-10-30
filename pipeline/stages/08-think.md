# 08 周末思辨

周末思辨已经是栏目包，写稿、课表参数、归档规则全在 `sections/think/SKILL.md`，照它做。只在周五出（任务书 `think` 为 `false` 时这一步跳过）。

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> think`，照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**读**：`issue/00-brief.json`（`think`、日期）、`data/thinking-plan.md`（可选）、任务单列出的话题池（`data/state/think/`，旧数据目录是 `data/think-log.md`）、`data/profile.md`、`data/child-questions.md`

**写**：`issue/08-think.json`

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[08]` 报错；两边都说出了理由；话题池里没用过
