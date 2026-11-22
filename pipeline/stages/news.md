# 17 环球小报

环球小报已经是栏目包，写稿、图片规则全在 `sections/news/SKILL.md`，照它做。

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> news`。任务单会打印各条 NewsCard 全文与「近期用过」清单（近期新闻 URL、实体、事件）。照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**读**：`issue/brief.json`（特别是 `brief.plan.news` 选题卡）、`data/profile.md`（兴趣）

**写**：`issue/news.json`

**照卡写与降级**：
- 每条新闻的 `sources` 必须包含对应卡片的 `url`，按卡片建议的 `angle` 和 `title_hint` 撰写，不能擅自换题。
- 若某条新闻核实不了或找不到能用的照片，严禁自己换题，必须运行 `node scripts/pipeline.mjs plan-fallback <issue> news <卡 id> "<原因>"`，将该卡标为作废后自选一条替代新闻。

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[news]` 报错；核对卡片 URL 对应关系与总账去重通过；每条两个来源说法一致；只看照片能认出是什么
