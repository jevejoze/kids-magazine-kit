# 15 英文三关（暂停，可选）

英文三关已经是栏目包，写稿规则全在 `sections/english/SKILL.md`，照它做。目前默认不做，家长在 `magazine.yaml` 的 `sections` 里写上 `english` 才做这一步。英文三关没有自己的页面，内容合并进挑战页。

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> english`，照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**读**：`issue/brief.json`、`issue/words.json`

**写**：`issue/english.json`

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[english]` 报错；第 1、2 关答案唯一
