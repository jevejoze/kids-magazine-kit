# 17 环球小报

环球小报已经是栏目包，写稿、图片规则全在 `sections/news/SKILL.md`，照它做。

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> news`，照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**读**：`issue/brief.json`、`data/profile.md`（兴趣）

**写**：`issue/news.json`

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[news]` 报错；每条两个来源说法一致；只看照片能认出是什么
