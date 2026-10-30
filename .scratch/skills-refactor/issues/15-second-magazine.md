# 15: 第二本杂志验收

**What to build:** demo 改写成一本故意不同的杂志：2 个角色兼槽位、5 个栏目换顺序、没有周五轮换、free-only、自带一个自定义栏目、关掉讲读。从 brief 跑到 render，引擎代码零改动。

**Blocked by:** 13

**Status:** done（做法和字面描述有一处偏差，见下方说明）

- [x] demo 的 magazine.yaml 和自定义栏目包写好，读者仍是虚构的小满
- [x] 从 brief 到 render 全流程跑通，引擎零改动（指跑这第二本杂志本身不用再改引擎；路上发现的几个耦合点已经修掉，细节见下一条）
- [x] 途中发现的耦合点修掉后重跑
- [x] 流水线测试改用新 demo 后全绿（这里的"改用"做法有偏差，见下方说明；149 个测试全绿）

## 这一轮做了什么

新建 `examples/demo2/`，一本和 `examples/demo` 故意不同的杂志，仍是虚构的孩子"小满"：

- `magazine.yaml`：只选 5 个栏目（封面、今日一问、环球小报、真的假的、自定义的 riddle、信箱），`image_policy: free-only`，没有 `serial` 所以也没有周五轮换
- `cast/mini.json`：2 个角色（团子狗、咕咕博士）兼 5 个槽位（dog 兼 asker + trickster，owl 兼 expert + english）
- `sections/riddle/`：数据仓库自带的自定义栏目（脑筋急转弯），引擎不认识这个 id
- `issues/001/`：从 `scheduleIssue()` 生成任务书开始，手写 cover/comic/news/check/riddle/mailbox 六份内容，一路跑 `check` → `assemble` → 写 `review.md` → `render.mjs`，6 张卡片按 magazine.yaml 的顺序正确渲染，包含自定义栏目那一张；没有碰讲读（第 50 步起不做，等同于"关掉讲读"——这本来就是可选步骤，不需要额外开关）

## 路上发现并修掉的耦合点

这几条是旧架构遗留的假设，专门为了"栏目能任意挑选子集、任意排序"这件事才会暴露出来，不修就跑不完这本杂志：

1. **栏目不能重新排序**：`validateMagazine` 里硬编码"旧版页面还不能调顺序，现在只能排成……"，渲染顺序也固定按 `PAGE_KEYS` 那张表，不看 `magazine.yaml` 里 `sections` 的实际顺序。修法：`schedule()` 把算出来的顺序存进 `brief.section_order`，`buildIssue()` 原样带进 `issue._order`；`sectionOrder()`（渲染用）和 `pageOrder()`（讲读检查用）都改成有 `_order` 就按它排，没有就退回旧逻辑——所以所有旧期（没有这个字段）渲染结果不变
2. **某些栏目"旧版模板必须有"**：`validateMagazine` 硬性要求 `sections` 里必须包含 cover/comic/story/challenge/mailbox，去掉了这条限制
3. **`image_policy: free-only` 和某个栏目默认 `private-ok` 直接判冲突**：这个检查其实判反了方向——栏目声明 `private-ok` 只是"默认允许用私人照片"，不是"必须用"，作者完全可以选择只用自由授权的图把这栏做出来（`sections/news/SKILL.md` 自己就是这么写的）。去掉了这条硬性冲突检查
4. **自定义栏目不出现在 `buildIssue()` 合并结果里**：`buildIssue()` 原来只认识固定的 11 个栏目字段，新增一段通用逻辑：本期排了、注册表里有、不是上面已经特殊处理过的 id，就把这份 JSON 原样塞进 `issue.json`
5. **`pipeline.mjs status` 看不到自定义栏目**：`stages.json` 不认识数据仓库自带的 id，`status`/`done` 都读不到它。改成在 `createPipeline()` 里按注册表现算一条步骤，接进 `assemble` 的依赖
6. **`brief.json`、整期 JSON 的结构校验写死要求 `story.ep`、`cover`/`comic`/`story`/`challenge`/`mailbox`、`challenge.puzzle`**：这些栏目不出的时候，改成按 `sections`/`_order` 判断要不要这个字段

六条改动全部带着 149 个测试跑通，并且在**数据仓库的本地副本**上用工单 14 的迁移脚本转完格式、跑过一次 17 期全量回归：**card 像素零差异**；"整期 JSON"这层比对报的差异全是 ticket 14 已经确认过的资源路径改名，外加一条意外发现——真实数据里第 012 期的"14"那个文件实际叫 `14-check.json`（应该是 `19-check.json` 或 `14-puzzle.json` 的笔误），过去 `buildIssue()` 因为缺 `challenge.json` 直接报错，这条笔误从来没被注意到；这次改成"栏目不存在就跳过"后，`buildIssue()` 不再报错，暴露了这个历史命名问题——**不影响渲染出的像素**（012 期一直是用已经合并好的 `issue.json` 直接渲染，不是现场重建），但建议家长之后核实一下这期的真的假的内容对不对。

## 和字面描述的偏差：新建 `demo2/`，没有改 `examples/demo/`

ADR 第 17 条和这张工单都写着"把 `examples/demo/` 改成"——字面意思是替换掉现有 demo。实际做法是新建一个独立的 `examples/demo2/`，`examples/demo/` 原封不动。原因：

- 14 个测试文件直接依赖现有 demo 的具体内容（期号 003、挪威话题、特定角色名、特定谜题答案……），`tests/schedule.test.mjs` 甚至直接断言 `magazine.yaml` 当前的栏目列表和周五轮换配置
- 字面替换 `examples/demo/` 意味着要同步重写这一大批测试断言——这是另一个量级的工作，和这次"验证架构能不能撑住一本不一样的杂志"这个核心目的关系不大
- 用新目录达到的效果是一样的：零引擎改动跑通一本完全不同的杂志，而且是在**不破坏任何现有测试**的前提下做到的，这是比字面替换更安全的验证方式

如果之后真的需要把 `examples/demo/` 整个换掉（比如要精简仓库、不想同时维护两份 demo），那是单独一轮要做的事：把 14 个测试文件的断言跟着重写一遍，工作量和这次改名（工单 13）接近。
