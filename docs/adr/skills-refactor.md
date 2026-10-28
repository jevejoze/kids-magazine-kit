# 栏目拆成可组合的 skill

状态：已定，未实施（2026-10-27）

## 背景

现在一本杂志的栏目、顺序、角色、周节奏都写死在引擎里：`assets/template.html` 硬编码目录、页序和每页的 `cards.push`；`style.css` 有 384 个选择器挂在固定的页面 id 上；`scripts/pipeline-lib.mjs` 集中了各栏目的校验、页序、`when` 逻辑和角色名；`00-brief` 同时装着全局字段、调度字段和栏目私有字段；`50-narration.md` 按固定页序写了每页怎么讲，提到角色名 61 次；`20-assets` 硬编码 6 个栏目的图片字段；`90-archive` 往四份档案里追加进度。

目标是把每个栏目抽成一个独立的 skill，由一份配置自由组合、编排。

## 决定

### 目标与边界

1. **先服务现有读者。** 验收标准：别人 clone kit，写一份不同的 `magazine.yaml`，就能出一本不同的杂志。做成多用户平台是远期选项，等有第二个真实家庭、量过每期成本再说。
2. **一个 skill = 一种页面形态。** 经典连载的书、音乐盒、放映室、动手做是四个 skill，周五轮换写在编排里。封面和今日一问分开，今日一问声明 `consumes: cover.question`。下载图片、审稿、讲读、归档是共享能力，由各 skill 调用。

### 数据与状态

3. **状态按 skill 分命名空间。** `state/<skill>/config.md` 由家长编辑，`state/<skill>/log.jsonl` 只追加进度。周五片单归编排；书目和分集计划归连载书 skill；未回收伏笔是小剧场 skill 的 `open-threads.md`。栏目步骤在输出 JSON 里给出 `threads_after` 这类状态变更，归档步骤落盘，所以一期定稿后状态才变。现有 markdown 档案一次性迁成 jsonl。
4. **brief 拆三层。** 编辑 agent 写全局字段（issue、date、topic_hint、child_question、focus、avoid、last_feedback）；确定性脚本按 `magazine.yaml` 算出调度，写进 `brief.sections`；栏目私有字段由各 skill 从自己的 log 推出。跨栏目撞题由审稿检查（"跨栏目撞题"一项）。
10. **配置分三份。** `magazine.yaml`：刊名、称呼、send_note、栏目列表和顺序、编排（星期主题、周五轮换）、cast、主题、image_policy、语音服务和每个角色的声音，现有 `voices/*.json` 并入这里，密钥只放环境变量。`MY_CHILD.md`：保持原样，agent 只读。`profile.md`：兴趣权重、难度观察、英文档位、待验证的推测。
18. **反馈按 skill id 记录。** `feedback.jsonl` 的 `favorite`、`dislike` 存 skill id，孩子原话照旧放 `quote`。家长转述的页名由 agent 对照当期 `pages.json` 换成 id。旧记录的中文页名随格式迁移一次性映射。策展按 id 汇总，给家长看时再换回页名。
19. **课表是编排层的 curriculum。** 跨栏目的周课表（如思维课表）放在 `magazine.yaml` 引用的 `curriculum/` 下，由家长维护。调度脚本按日期取本周一行，作为 params 注入相关 skill（如 check 的 `focus`/`choices`/`tools`、think 的 `focus`/`friday_topic`）。没有课表时用默认值。"页面和讲读不提练什么"写成共享规则 `core/rules/no-visible-pedagogy.md`，相关 skill 声明引用。

### skill 契约

5. **角色走功能槽位。** 规则和校验只写槽位：asker、expert、english、trickster、narrator。JSON 里照旧写具体角色（`dog:surprise:150`）。cast 包把槽位映射到角色，一个角色可以兼多个槽位，最少 2 个角色。
6. **渲染契约。** 每个 skill 提供 `page.js`，导出 `render(data, kit) => html[]`（可以出多页），和 `page.css`。`kit` 提供 topBar、foot、ch、bub、中文断行、toc、next 和 cast。页面尺寸由渲染器固定；`page.css` 的选择器必须以 `#<skill-id>` 开头（静态检查）。
7. **讲读按 skill 分骨架。** 每个 skill 的 `narrate.md` 写本页骨架：主持槽位、句数上限、读哪些字段、哪些不念。整期讲读稿仍由一个 agent 按全局规则写。渲染步骤输出 `pages.json`（card → skill id）。manifest 声明 `narration.lines`，按 10–12 分钟总长等比缩放。按页的讲读检查进各 skill 的 `check.mjs`，整期检查留在讲读能力里。
8. **图片由各 skill 自己下载。** 在自己那一步用共享的 `assets.mjs` 下到 `20-assets/<skill-id>/`，第 20 步取消。manifest 声明图片授权策略（`free-only` / `private-ok`），和杂志的 `image_policy` 对照检查。折纸图式拆分成为连载 skill 的私有逻辑。
11. **打包用标准 Agent Skill 格式。** `sections/<id>/` 下有带 frontmatter 的 `SKILL.md`、`manifest.json`、`schema.json`、`check.mjs`、`page.js`、`page.css`、`narrate.md`。引擎自带的 skill 放在引擎的 `sections/`；数据仓库的 `sections/` 只能新增 id，同名覆盖直接报错。
12. **参数由 manifest 声明。** params 表写类型、默认值、范围。合并后的参数放进 `brief.sections.<id>.params`；`SKILL.md` 在正文里引用，`check.mjs` 和 `page.js` 读同一个对象。未声明的参数报错，`SKILL.md` 里不做模板替换。第一期只开放三项：周五轮换（连载）、`image_policy`（全局）、讲读句数上限。
13. **全局规则拆文件。** `core/rules/*.md`，skill 在 manifest 里声明（`rules: [images, english-level]`）。内容红线和 cast 包隐式包含，红线不能声明掉。根 `SKILL.md` 只做路由；审稿读所有已声明规则的并集。
14. **用任务单调用 skill。** `node scripts/pipeline.mjs ticket <issue> <skill>` 打印拼好的任务单：红线、声明的规则、cast 映射、brief 全局字段、params、state 路径、consumes 的值和输出路径。agent 把任务单指纹写进输出的 `_meta.ticket`，`check` 发现任务单变了就标记输出过期。

### 落地

9. **命名与迁移。** 去掉数字前缀，用 skill id 命名：`issues/NNN/story.json`；brief、review、narration、audio、video、archive 是保留名。一次性迁移脚本把目录格式的旧期转成新格式，单文件和 `legacy/` 归档保持原样。回归方法：先用当前引擎把这些期重渲染一遍作为基线，迁移后用新引擎再渲染，逐像素比对。
15. **分支开发，main 即出刊版本。** 数据仓库不锁引擎版本（2026-10-28 家长：「要用哪一版不应该本地自己决定」，`engine.ref` 已去掉），`session-start.sh` 始终用远端 main 最新。重构在引擎的 `skills` 分支上做，没准备好不合进 main。切换条件：迁移的全部旧期像素一致，并且用新引擎在分支上完整试出一期、审稿通过。之后在两期之间跑迁移脚本、把 `skills` 合进 main、出下一期。
16. **打样顺序：先小剧场，再经典连载。** 小剧场用到状态（伏笔由栏目步骤判断、归档落盘）、四个角色的讲读和 cast 槽位；经典连载补上周五轮换 params、一种形态拆四个 skill、自带图片下载和授权策略。两者跑通后，其余栏目照模板并行抽。每抽完一个，对用到它的旧期做像素比对。
17. **第二本杂志做验收样本。** 把 `examples/demo/` 改成一本故意不同的杂志：cast 2 个角色（一个兼 asker + trickster，一个兼 expert + english）；只选封面、今日一问、环球小报、真的假的、信箱 5 个栏目并换顺序；没有周五轮换；`image_policy: free-only`；数据仓库自带一个自定义栏目（如 `sections/riddle/`）；关掉讲读。从 brief 跑到 render，引擎代码零改动才算通过；途中改了引擎，就把对应耦合点记下来修。

## 阶段

1. `session-start.sh` 锁定引擎版本（独立小改动，先做）
2. 在 `skills` 分支建基础设施：manifest、ticket、kit、`pages.json`、`core/rules/`
3. 抽小剧场，再抽经典连载，逐个像素比对
4. 批量抽其余栏目，写迁移脚本，全量回归
5. 改 `examples/demo/` 做第二本杂志验收
6. 试刊通过后切换
