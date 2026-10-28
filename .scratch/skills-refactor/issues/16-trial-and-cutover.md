# 16: 试刊与切换

**What to build:** 在数据仓库分支上用 skills 引擎完整出一期并审稿通过；在两期之间合并 kit、打 v2、正式数据跑迁移、engine.ref 改成 v2，接着出下一期。

**Blocked by:** 01, 14, 15

**Status:** ready-for-agent

- [ ] 数据仓库试刊分支上迁移后完整出一期，审稿通过，试刊只在这个分支
- [ ] kit 合并 skills 到 main 并打 v2（推送前和家长确认）
- [ ] 正式数据跑迁移、engine.ref 改成 v2，下一期正常出刊
- [ ] 回退路径验证过：engine.ref 改回 v1 并 revert 迁移提交后能出刊
