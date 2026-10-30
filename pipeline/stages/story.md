# 13 小剧场

小剧场已经是栏目包，写稿规则全在 `sections/story/SKILL.md`，照它做。

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> story`，照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**读**：`issue/brief.json`（`story`）、任务单列出的状态文件（`data/state/story/config.md`、`log.jsonl`、`open-threads.md`；旧数据目录是 `data/story-bible.md`）

**写**：`issue/story.json`

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[story]` 报错；只看正文能不能推出 `secret` 里的真相
