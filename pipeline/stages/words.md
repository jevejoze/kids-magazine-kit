# 12 单词屋（暂停，可选）

单词屋已经是栏目包，写稿、排版和归档规则全在 `sections/words/SKILL.md`，照它做。目前默认不做，家长在 `magazine.yaml` 的 `sections` 里写上 `words` 才做这一步。

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> words`，照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**读**：`issue/brief.json`（主题、`english_level`）、`data/vocab.json`（已学单词，避免重复）

**写**：`issue/words.json`

**自检**：`node scripts/pipeline.mjs check <issue>` 没有 `[words]` 报错；数每句例句的词数；查 `vocab.json` 无重复
