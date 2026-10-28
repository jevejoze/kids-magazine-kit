# 01: 数据仓库锁定引擎版本

**What to build:** 家长在数据仓库写一行 `engine.ref`（tag 或分支），新会话启动时 `.engine` 就检出那个版本；kit main 当前状态打成 `v1`，日常出刊锁在 v1。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] kit main 打 tag `v1` 并推送（推送前和家长确认）
- [ ] `engine.ref` 写 `v1` 时，新会话的 `.engine` 停在 v1
- [ ] `engine.ref` 写 `skills` 时检出分支并 fast-forward；写回 `v1` 再切回来
- [ ] 没有 `engine.ref` 时保持现有行为（pull 当前分支）
- [ ] fetch 失败时提示并沿用本地版本，会话照常启动
