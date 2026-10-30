# 11: 迁移：信箱 + 单词屋 + 英文三关

**What to build:** 信箱、单词屋、英文三关成为栏目包；单词屋和英文三关由 magazine.yaml 开关，开了自动排进对应位置。

**Blocked by:** 07

**Status:** done

- [x] 三个栏目包齐全（英文三关没有自己的页面，内容并进挑战页，仍注册为栏目包以便领任务单、校验 15-english.json）
- [x] 可选栏目关着时不出页、不进讲读；开着时位置和现在一致（沿用现成的 schedule.mjs 开关机制，tests/schedule.test.mjs 已覆盖）
- [x] 信箱的 send_note 来自 magazine.yaml（经 00-brief.json 带下来，buildIssue 不再读 16-mailbox.json 里的 send_note）
- [x] 相关旧期像素一致
