# 16 信箱

信箱已经是栏目包，写稿规则全在 `sections/mailbox/SKILL.md`，照它做。

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> mailbox`，照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**读**：`issue/00-brief.json`（`last_feedback`）、`data/letters.md`、周六读上一期的 `issue/08-think.json`

**写**：`issue/16-mailbox.json`（不写 `send_note`：页脚"说给谁听"来自 `magazine.yaml`）

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[16]` 报错；字数；没有上期答案
