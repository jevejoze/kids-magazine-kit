# 12: 讲读共享能力

**What to build:** 讲读 agent 按 pages.json 和各栏目的 narrate.md 拿到整期骨架；句数上限按 10–12 分钟总长等比缩放；按页讲读检查走各栏目 check，整期检查留在讲读能力里。

**Blocked by:** 06

**Status:** done

- [x] 讲读骨架由 pages.json + narrate.md 生成，卡号不再依赖固定页序（`ticket.mjs` 的 `narrationSkeleton`：渲染过就用 `40-cards/pages.json`，没渲染就用 `sections.mjs` 的 `sectionOrder(30-issue.json)`；每页带上那个栏目包自己的 `narrate.md` 和缩放后的句数上限，印在任务单的「本期骨架」一节）
- [x] 句数上限随本期栏目数缩放，有测试（`scripts/narration-budget.mjs`：`defaultMaxLines` 读每个栏目包自己的 `manifest.narration.lines`；`scaledMaxLines` 按本期页数/基线页数等比收紧，带最低 6 句的下限；任务书显式写的 `narration_lines` 直接用、不缩放。基线页数取现有栏目能凑出的最多页数 10，所以今天的任何一期都不会被缩放，只有以后栏目更多、页数真超过 10 才会收紧——测试 `tests/narration-budget.test.mjs` 专门构造超基线的页序验证公式）
- [x] 按页检查调用各栏目 check；整期检查（总长、旁白占比、答案不念）保留（挑战「不说答案哪天公布」、环球小报「三条关键词都讲到」、今日一问「试试收尾」、信箱「说给对的人/不猜谜/不公布上期答案」、连载「吐槽由认领角色自己说」这六条挪进对应栏目包 `check.mjs` 的新导出 `checkNarration(lines, ctx)`，由讲读检查在按页循环里调用；旁白占比、语气起伏、字数、总长、照抄页面文字、年份数字这些跨页/全局的规矩留在 `pipeline-lib.mjs`）
- [x] demo 的讲读稿 check 结果和旧版一致（`tests/pipeline.test.mjs` 现有的"complete demo assembles and narration agrees with rendered page contract"测试继续通过，没有改断言）
