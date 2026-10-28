# skill 重构开发计划

依据：[docs/adr/skills-refactor.md](../adr/skills-refactor.md) 的 19 条决定。开发在 kit 的 `skills` 分支上（本地 worktree `kids-magazine-kit-skills`），日常出刊留在 main。

## 现状要点

- 页面：`assets/template.html` 用 11 段 `cards.push` 按固定顺序出页，section id 是 `c1` `c2` `cdeep` `c3` `c4` `c5` `cnews` `ccheck` `cserial` `cthink` `c6`；`style.css` 508 行挂在这些 id 上
- 契约：`scripts/contracts.mjs` 集中了 `PAGE_KEYS`、`CARD_IDS`、`PAGE_TITLES`、`NARRATION_MAX_LINES`、角色表和每步 JSON 的字段契约
- 校验：`scripts/pipeline-lib.mjs`（629 行）放着各栏目的编辑校验、页序和 `when` 逻辑
- 流水线：`pipeline/stages.json` 列 21 步，用 `when`、`optional` 控制出不出
- 测试：`node --test tests/*.test.mjs`，6 个测试文件，fixture 用 `examples/demo/`
- 数据仓库：`issues/003`–`020` 是目录格式（003–005 只有 `30-issue.json`、图解和图片），`006.json` 和 `legacy/` 是单文件

## 里程碑

每个里程碑结束时 `node --test` 全绿，回归脚本全部一致，然后提交。

### M0 锁定引擎版本（main 上做，独立小改动）

- kit main 打 tag `v1`，作为日常出刊版本
- 数据仓库加 `engine.ref`（内容 `v1`）；`.claude/session-start.sh` 改成 `fetch` 后检出 `engine.ref` 指的版本：tag 直接检出，分支检出后 `pull --ff-only`；`engine.ref` 不存在时沿用现在的行为
- 验收：新会话 `.engine` 停在 `v1`；`engine.ref` 写 `skills` 后切到重构分支，写回 `v1` 再切回来

### M1 回归基线

- `scripts/regress.mjs <data> <out>`：对每个目录格式的期，用当前引擎渲染 `30-issue.json` 到 `<out>/NNN/`，再逐张比对。比对用 ffmpeg 解码后的像素 md5（`ffmpeg -i card.png -f md5 -`），不加新依赖
- 先在同一引擎上连渲两遍，确认渲染本身可复现；有浮动（字体、动画、时间戳）先修掉
- 第二层回归：旧 `assemble` 和新 `assemble` 产出的 `30-issue.json` 做结构比对
- 基线和对比图只放本地 `output/`，含新闻原图，不进任何仓库
- 验收：v1 基线 003–020 两遍渲染逐像素一致

### M2 基础设施

- **栏目注册表**：读引擎 `sections/` 和数据仓库 `sections/`，同名报错；manifest 校验（id、title、consumes、params、rules、image policy、narration.lines、state）
- **`magazine.yaml`**：加载和校验；Node 没有内置 YAML，用一个只支持 map、list、标量的极小解析器放进 `scripts/`，配一组测试
- **调度脚本**：按 `magazine.yaml` 和日期算出 `brief.sections`（出哪些栏目、顺序、params、周五轮换、课表注入），替代 `stages.json` 里的 `when`、`optional`
- **任务单**：`pipeline.mjs ticket <issue> <skill>`，输出指纹写进 `_meta.ticket`，`check` 发现变了就标过期
- **kit 对象**：把 `template.html` 里的 topBar、foot、ch、bub、中文断行、toc、next 抽成 `scripts/kit.mjs`
- **混合渲染器**：注册表里有的栏目走 `page.js` + `page.css`，没有的继续走旧模板那一段。这样可以一个栏目一个栏目地迁，每次都能做像素比对。渲染同时输出 `pages.json`
- **CSS 作用域检查**：`page.css` 每个选择器以 `#<skill-id>` 开头
- **`core/rules/`**：从根 `SKILL.md` 拆出红线、图片、英文档位、讲读、no-visible-pedagogy；cast 包写成 `cast/default.json`（槽位到角色）
- 验收：注册表为空时，新渲染器的输出和 v1 基线逐像素一致

### M3 打样一：小剧场

- `sections/story/`：`SKILL.md`（来自 `13-story.md`）、`manifest.json`、`schema.json`（来自 contracts）、`check.mjs`（来自 pipeline-lib 的小剧场校验）、`page.js`（来自模板 `#c4` 那段）、`page.css`（`#c4` 选择器改成 `#story`）、`narrate.md`（来自 `50-narration.md` 的小剧场部分）
- 状态：`state/story/config.md`、`log.jsonl`、`open-threads.md`；栏目输出 `threads_after`，归档步骤落盘
- 规则和校验里的角色名改成槽位
- 验收：全部旧期像素一致；用 ticket 在测试 fixture 上跑通一期小剧场，check 通过

### M4 打样二：经典连载

- 拆成 `serial-book`、`music`、`film`、`make` 四个 skill，共用的版式放进 kit
- 周五轮换写进调度；书目、分集计划进 `state/serial-book/`，片单归编排
- 图片：用共享的 `assets.mjs` 下到 `20-assets/<skill-id>/`；manifest 声明 `free-only`，和 `image_policy` 对照；折纸图式拆分移进 `make`
- 验收：同 M3，再加一个周五期的像素比对

### M5 其余栏目

封面、今日一问（`consumes: cover.question`）、怪物档案、挑战、环球小报、真的假的、周末思辨、信箱，以及可选的单词屋、英文三关。照 M3、M4 的模板做，每个栏目单独提交、单独回归。真的假的和周末思辨接课表注入，并声明 no-visible-pedagogy 规则。

这一步的栏目之间互不依赖，可以分给几个会话并行，前提是每个会话只动自己的 `sections/<id>/` 和模板里对应的那一段。

验收：旧模板里的栏目代码全部删光，`style.css` 只剩全局样式。

### M6 共享能力和流水线

- 讲读：从 `pages.json` 和各栏目的 `narrate.md` 拼出整期骨架；句数上限按 10–12 分钟等比缩放；按页检查调各栏目的 `check.mjs`，整期检查留在讲读能力里
- 审稿：读已声明规则的并集，加上跨栏目撞题检查
- 归档：写各栏目的 `log.jsonl` 和状态变更
- 删掉第 20 步；`stages.json` 改成由注册表和保留名生成；`sync.sh` 认 skill id
- 根 `SKILL.md` 改成路由，`CLAUDE.md`、`AGENTS.md`、`pipeline/README.md` 跟着改

### M7 数据迁移脚本

`scripts/migrate-v2.mjs <data>`，可重复运行，先在数据仓库的副本上跑：

- 旧期文件改名：`13-story.json` → `story.json` 等，`006.json` 和 `legacy/` 保持原样
- `feedback.jsonl` 的中文页名换成 skill id，原话留在 `quote`
- `story-bible.md`、`serial-bible.md`、`creature-log.md`、`think-log.md` 拆成各栏目的 `config.md` 和 `log.jsonl`
- `profile.md` 开头的刊名、称呼、send_note，以及 `voices/*.json`，并进 `magazine.yaml`；`thinking-plan.md` 移到 `curriculum/`
- 验收：迁移后用新引擎渲染全部旧期，和 v1 基线逐像素一致

### M8 第二本杂志

把 `examples/demo/` 改成 ADR 第 17 条描述的那本：2 个角色兼槽位、5 个栏目换顺序、没有周五轮换、`free-only`、自带 `sections/riddle/`、不出讲读。从 brief 跑到 render 时引擎零改动；中途要改引擎的地方都记成耦合点，修完重来。

### M9 试刊和切换

- 在数据仓库开 `skills-trial` 分支，迁移后用 `engine.ref: skills` 完整出一期，审稿通过；试刊只在这个分支上，不进 main
- 切换放在两期之间：kit 合并 `skills` 到 main 并打 `v2`；数据仓库 main 跑迁移脚本、`engine.ref` 改成 `v2`，接着出下一期
- 回退：`engine.ref` 改回 `v1`，数据仓库 revert 迁移提交

## 顺序

M0 和 M1 可以同时做。M2 依赖 M1 的回归脚本。M3 → M4 按顺序做，M5 在 M4 之后并行。M6 可以在 M5 进行中开工，M5 结束时收尾。M7 依赖 M6。M8、M9 最后做。

## 风险

- **渲染不可复现**：M1 第一件事就是验证；不稳定的地方先修，再谈逐像素
- **YAML 解析**：自写的子集解析器要有测试；`magazine.yaml` 只用 map、list、标量
- **重构期间 main 还在改**：日常出刊对引擎的修复先进 main，每周把 main 合进 `skills` 一次，冲突当场解决
- **私有素材外泄**：回归输出、试刊数据都留在本地或私有数据仓库；kit 的测试只用 `examples/demo/`
