# 19 真的假的

真的假的已经是栏目包，写稿、课表参数、归档规则全在 `sections/check/SKILL.md`，照它做。每天出。

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> check`。任务单会打印 check 选题卡全文（标题带「选题卡（照写，不换题）」）与「近期用过」清单（实体、近期说法）。照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**读**：`issue/brief.json`（特别是 `brief.plan.check` 选题卡）、`data/thinking-plan.md`（可选）、`data/profile.md`、任务单的 `skill`/`choices`/`tools` 参数

**写**：`issue/check.json`

**照卡写与降级**：
- 必须忠于选题卡照写，不能擅自换题。`check.json` 的 `claim` 去空格后必须等于卡片的 `claim`。
- 若卡片核实不通，严禁私自换题，必须运行 `node scripts/pipeline.mjs plan-fallback <issue> check "<原因>"`，由脚本自动替换为备用卡或降级为自选。

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[check]` 报错；核对忠实度与总账去重通过；真假结论两个来源说法一致；3 条线索不剧透
