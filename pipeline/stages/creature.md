# 09 传说怪物档案

怪物档案已经是栏目包，写稿、图片、归档规则全在 `sections/creature/SKILL.md`，照它做。只在周一出（任务书 `creature` 为 `false` 时这一步跳过）。

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> creature`，照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**读**：`issue/brief.json`（`creature`）、`data/profile.md`（兴趣）、任务单列出的档案（`data/state/creature/`，旧数据目录是 `data/creature-log.md`）

**写**：`issue/creature.json`

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[creature]` 报错；编号接得上；传说图是公有领域老图，照片拍的是原型、授权写清
