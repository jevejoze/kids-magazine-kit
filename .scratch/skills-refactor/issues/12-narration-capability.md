# 12: 讲读共享能力

**What to build:** 讲读 agent 按 pages.json 和各栏目的 narrate.md 拿到整期骨架；句数上限按 10–12 分钟总长等比缩放；按页讲读检查走各栏目 check，整期检查留在讲读能力里。

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] 讲读骨架由 pages.json + narrate.md 生成，卡号不再依赖固定页序
- [ ] 句数上限随本期栏目数缩放，有测试
- [ ] 按页检查调用各栏目 check；整期检查（总长、旁白占比、答案不念）保留
- [ ] demo 的讲读稿 check 结果和旧版一致
