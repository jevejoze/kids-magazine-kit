# 10 封面选题

封面已经是栏目包，写稿规则全在 `sections/cover/SKILL.md`，照它做。

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> cover`。任务单会打印 cover 选题卡全文（标题带「选题卡（照写，不换题）」）与「近期用过」清单（实体、机制、历史问题）。照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**读**：`issue/brief.json`（特别是 `brief.plan.cover` 选题卡）、`data/profile.md`（兴趣权重）

**写**：`issue/cover.json`

**照卡写与降级**：
- 必须忠于选题卡照写，不能擅自换题。`cover.json` 的 `question.zh` 去标签和空格后必须等于卡片的 `question`。
- 若来源打不开、数字对不上、找不到可用照片且无法解决时，严禁私自换题，必须运行 `node scripts/pipeline.mjs plan-fallback <issue> cover "<原因>"`，由脚本自动替换为备用卡或降级为自选。

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[cover]` 报错；核对忠实度与总账去重通过；答案能在 `sources` 里查到；渲染后主体没被刊名、问题、角色挡住
