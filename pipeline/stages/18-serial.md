# 18 经典连载

**目标**：信箱前面的一页。平时连载一本经典儿童书，一期讲一段，停在悬念上；周五（艺术日）换成「音乐盒」「放映室」或「动手做」。

这一页按本期 `kind` 由四个栏目包之一出，规则、字段、图片和归档都写在包里：

| kind | 栏目包 | 说明 |
|---|---|---|
| `book` | `sections/serial-book/SKILL.md` | 平时：公版经典儿童书一回 |
| `music` | `sections/serial-music/SKILL.md` | 周五：一首曲子 + 3 个边听边找 |
| `film` | `sections/serial-film/SKILL.md` | 周五：一部电影 + 3 个看完回答 |
| `make` | `sections/serial-make/SKILL.md` | 周五：折纸（完整图式）或 3D 打印 |

周五出哪一种由 `magazine.yaml` 的 `schedule.friday.serial` 轮换，第 00 步写进任务书 `sections.serial.params.kind`。

**开工**：领任务单 `node scripts/pipeline.mjs ticket <issue> serial`，任务单会领到本期 kind 的那个包；照那个包的 `SKILL.md` 写 `issue/18-serial.json`，最后一行的指纹写进 `_meta.ticket`。

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[18]` 报错，再照包里的自检逐条过
