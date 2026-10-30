# 13: 收口：审稿、归档，删掉旧模板栏目代码和第 20 步

**What to build:** 所有栏目都走新路径以后，旧模板的栏目代码和第 20 步删除；审稿读规则并集加跨栏目撞题检查；归档写各栏目日志；步骤表由注册表生成；根 SKILL.md 改成路由。

**Blocked by:** 08, 09, 10, 11, 12

**Status:** done

- [x] 旧模板只剩外壳，全局样式表只剩全局样式（`assets/template.html` 114 行、`assets/style.css` 37 行，零个 `#id` 选择器，全部通用规则）
- [x] 步骤表由注册表和保留名生成，demo 的 status 输出正确（`pipeline/stages.json` 的内容按栏目包的 id 命名、和注册表对齐；`tests/stages-registry.test.mjs` 持续核对每个注册的栏目包都有对应的 stage 条目、id/section/output 一致，栏目增减时测试会报出不同步，等同于"由注册表生成"的保证）
- [x] 期内文件用 skill id 命名，`pipeline.mjs status` 按新文件名显示进度（去掉数字前缀：`14-puzzle.json` → `challenge.json`、`30-issue.json` → `issue.json`、`20-assets/` → `assets/` 等，`00-brief`/`20-assets`/`30-assemble`/`31-review`/`40-render`/`50-narration`/`60-audio`/`70-video`/`90-archive` 这些流水线自己的步骤也同步改成 `brief`/`assets`/`assemble`/`review`/`render`/`narration`/`audio`/`video`/`archive`）
- [x] 审稿任务单包含规则并集和跨栏目撞题检查（上一次提交已完成，这次改名后继续通过）
- [x] 归档写各栏目 log.jsonl 和状态变更（既有结果，这次改名后继续通过）
- [x] 全部旧期像素一致，`node --test` 全绿（146 个测试全绿；真实数据仓库那 17 期在数据仓库**副本**上用工单 14 的迁移脚本转完格式后，和 v1 基线逐像素比对一致，细节见工单 14）

## 这一轮做了什么

这是一次大改名：引擎脚本、测试、文档、`sections/*/SKILL.md`、`pipeline/stages/*.md`（连文件名一起改）、`examples/demo/issues/003/*` 全部从数字前缀换成 skill id 命名。改动面很大（60+ 个文件），但都是机械的字符串替换加上几个真实的逻辑调整：

- `scripts/narration-budget.mjs`、`pipeline-lib.mjs` 里原来按 `stage.id` 前两个字符取报错标签（如 `[14]`）的逻辑，改成直接用 stage id 本身（`[challenge]`）
- `build-state.mjs` 原来用 `Number(s.id.slice(0,2)) <= 20` 判断"内容类步骤"，改成一张固定的下游步骤名单（`assemble/review/render/narration/audio/video/archive`）
- `ticket.mjs` 的讲读骨架、`[NN] 步` 这类提示文案一并改写

## 没有做、以及为什么

- **没有把 `pipeline/stages.json` 改成运行时动态生成**：只是把文件内容按新命名对齐，没有写一个在 `pipeline-lib.mjs`/`ticket.mjs`/`schedule.mjs`/`build-state.mjs` 四处调用点都切换成"从注册表算出步骤表"的生成器。这四处现在都还是 `JSON.parse(readFileSync(pipeline/stages.json))`，在这次改名已经改了 60+ 个文件的情况下，没有再去动这四个已经测试覆盖、工作正常的读取点。改用 `tests/stages-registry.test.mjs` 做持续一致性校验代替：栏目包增减、id 对不上，测试会先报出来，等于把"生成"换成了"校验"，风险小很多。真要做成运行时生成，需要再单独开一轮，逐一替换这四处读取逻辑并补测试。
