# 50 讲读稿

**目标**：把整期改写成分角色朗读的脚本，给第 60、70 步做语音和视频。

**读**：`issue/30-issue.json`、`issue/31-review.md`（确认已通过）、SKILL.md「讲读版」一节

**写**：`issue/50-narration.json`，格式：`{"_meta": {...}, "narration": [{"card": 1, "lines": [...]}, ...]}`，每句的字段（`who` `lang` `text` `pause` `repeat` `rate` `hold`）见 SKILL.md「讲读版」

**规则**：完全按 SKILL.md「讲读版」的"每页讲什么"和"规矩"写：不念答案；数字写成读法；每句 ≤ 40 字或 ≤ 15 个英文单词；全期 ≤ 3000 字

**自检**：7 页都有；统计总字数；每句 `who` 和 `lang` 合法
