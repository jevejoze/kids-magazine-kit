# 主编 / 执行 两角色 + 选题卡 + 题目总账（设计规格）

> 本文是实现契约：代码（scripts/、tests/）和文档（roles/、core/rules/、pipeline/stages/）都按这里的名字、字段、命令实现。改动契约先改本文。

## 0. 背景

实际运行发现两个问题：
1. **重复**：016–024 期里，新闻「新野猫」016/018、「旅行者 1 号」017/019、「水母搭车」017/020，真的假的「章鱼三颗心」018/022。原因是去重只靠"读最近几期、避免重复"的提示，新闻栏完全没有去重，引擎也没有用过的题的总账。
2. **选题质量差**：执行出刊的 agent 模型较弱，选题需要判断力。

方案：
- 去重改成**脚本强制**：题目总账 `state/topics.jsonl` + 窗口规则，在出选题（`plan-check`）和出稿（`pipeline.mjs check`）两处拦截。
- 拆成两个**角色**：**主编 `editor`** 负责选题（每周预排 + 前一晚定稿），**执行 `producer`** 照选题卡出刊、不换题。哪个 agent 担任什么角色在安装时指定，引擎和规则里不写任何 agent 的名字。
- 两个角色都由各自的**定时任务**触发，什么时间跑由定时任务决定，**不写进任何仓库**。定时任务只调一条命令 `sh .engine/scripts/run.sh`，它按"本机角色 + 今天日期 + 仓库状态"决定现在该做什么；重复触发不会重复干活。
- 两边通过**数据仓库**协作（git 拉取/推送），不需要别的通信渠道。
- 重要事件生成**通知文本**，agent 用自己的渠道发给家长（只周知，不审批）。

## 1. 角色与安装

数据仓库根目录下的本机文件 `.agent.yaml`（**进 .gitignore，不进仓库**）：

```yaml
role: editor            # editor | producer | [editor, producer]
name: 某某              # 可选，写进 _meta.by、锁文件和通知里；没写就用主机名
```

也可以用环境变量：`KIDS_MAG_ROLE=editor`（多个用逗号）、`KIDS_MAG_AGENT=某某`。环境变量优先于文件。

- 没配置角色：`run.sh` 报错退出，提示怎么配置。
- 只装了执行、没装主编：执行照旧能出刊（选题卡缺失时走"自选"降级，见 §5），去重照样拦截。
- 一个 agent 可以同时担两个角色。

角色规则文档：`roles/editor.md`、`roles/producer.md`（引擎仓库）。`run.sh` 输出里会指向对应的文档。

## 2. 统一入口：`scripts/run.sh` → `scripts/next.mjs`

```bash
sh .engine/scripts/run.sh [--date YYYY-MM-DD] [--role editor|producer]
```

- 在数据仓库里运行。先 `git pull --rebase --autostash`（失败就打印原因、退出码 2）。
- `--date` 只用于测试和补跑，默认取本机今天的日期。`--role` 覆盖本机配置（测试用）。
- 输出（stdout，markdown），第一行固定为机读行：

```
ACTION: <none|weekly-plan|finalize|produce|resume|blocked> [role=<role>] [date=YYYY-MM-DD] [week=YYYY-Www] [issue=issues/NNN]
```

  后面是给 agent 的任务清单（要读哪份角色文档、按顺序做什么、做完跑什么命令）。同时担两个角色时，依次输出两段，每段各有一行 `ACTION:`。
- 需要立刻告诉家长的事（见 §8），输出一段：

```
NOTIFY:
<给家长的消息，多行纯文本>
```

- 退出码：0 正常（包括 `ACTION: none`），2 出错（拉取失败、没配角色、数据损坏）。

### 2.1 主编的判断（target = 明天）

1. `week` = 明天所在的 ISO 周（如 `2026-W49`）。`plan/<week>.json` 不存在 → `ACTION: weekly-plan`（任务清单：先做本周策展，再排这一周 7 天的选题卡和备用卡，**接着把明天定稿**）。周日跑时明天是周一，所以自然在周日排下周。
2. 明天那一天已经开工（有某期的 `brief.json` 日期等于明天）→ 已锁定，不再处理明天。
3. 明天那一天 `status` 不是 `ready` → `ACTION: finalize date=<明天>`（挑新闻、处理插入的变更、标 ready）。
4. 否则 `ACTION: none`。

### 2.2 执行的判断（target = 今天）

1. 找日期等于今天的那一期（遍历 `issues/NNN/brief.json` 的 `date`）。
2. 没有 → `ACTION: produce issue=issues/<最新期号+1> date=<今天>`；同时检查今天的选题卡：
   - `ready` → 正常；
   - `draft` → 照用，并输出 NOTIFY「今天的选题没定稿，按周排草稿出刊」；
   - 没有 plan 或没有这一天 → 输出 NOTIFY「今天没有选题卡，执行自选（去重照样拦截）」。
3. 有，但 archive 没完成 → `ACTION: resume issue=...`，附 `pipeline.mjs status` 的输出。
4. archive 已完成 → `ACTION: none`。
5. 锁：开工（produce）时先写 `issues/NNN/.lock`（JSON：`{"by","role","at","host"}`），`git add` + commit + push。push 被拒且远端已有别人的锁 → `ACTION: blocked`，说明谁在做，退出。锁超过 6 小时没有新提交视为失效，可以接手（输出里说明接手了谁的锁）。archive 完成后由 `sync.sh push` 一起提交删除锁（`next.mjs` 在 `ACTION: none` 时若发现已完成期还留着锁，就删掉并提示推送）。`.lock` 不进 `.gitignore`。

## 3. 选题卡：`plan/<YYYY-Www>.json`

主编写，数据仓库里提交。一周一个文件。

```jsonc
{
  "week": "2026-W49",
  "by": "<agent 名>",
  "at": "2026-11-29T21:05:00+08:00",
  "curation": "2026-11-29 策展：……（一两句，本周选题依据）",
  "days": {
    "2026-11-30": {
      "status": "ready",                 // draft | ready；执行只把 ready 当定稿
      "revised": [                       // 前一晚定稿时的变更记录，可空
        {"at": "2026-11-29T21:10:00+08:00", "by": "<agent>", "what": "换封面", "why": "妮妮问了鲸鱼怎么睡觉（child-questions 11-29）"}
      ],
      "cover": { /* CoverCard */ },
      "check": { /* CheckCard */ },      // 本期不出真的假的时省略
      "news":  [ /* NewsCard，定稿时才填；周排时可空数组 */ ],
      "notes": "给执行的其他提示（可选）"
    }
  },
  "spares": {
    "cover": [ /* CoverCard，≥ 2 张 */ ],
    "check": [ /* CheckCard，≥ 1 张 */ ]
  }
}
```

`days` 只能放这一 ISO 周里的日期；本周不出刊的日子可以不写。

### 3.1 CoverCard（封面 + 今日一问共用）

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✓ | 全局唯一，小写字母数字和连字符，如 `c-whale-sleep` |
| `question` | ✓ | 封面问题原文（可含 `<br>`），去掉标签后 ≤ 24 字 |
| `mechanism` | ✓ | 今日一问要讲清的机制，一句话 |
| `mechanism_key` | ✓ | 机制的规范短名，用于去重，如 `半脑睡眠`、`大气压` |
| `number` | ✓ | `{"value": "可核实的数字", "source": "https://…"}` |
| `misconception` | ✓ | 要纠正的常见误解 |
| `answer` | ✓ | 一句话答案 |
| `why_nini` | ✓ | 为什么适合这个孩子，引用依据（profile、随手记日期、来信、child-questions） |
| `avoid` |  | 不要讲成什么样 |
| `entities` | ✓ | 核心实体，≥ 1 个，规范中文名，如 `["抹香鲸"]` |
| `sources` | ✓ | 参考来源 URL，≥ 1 |
| `asked_by` |  | 孩子提的问题时写称呼 |
| `photo_hint` |  | 封面照片方向 |
| `allow_repeat` |  | 有意重复（系列、新进展）时写理由，去重错误降为警告 |

### 3.2 CheckCard（真的假的）

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✓ | 同上，如 `k-octopus-hearts` |
| `claim` | ✓ | 说法原文，≤ 30 字 |
| `truth` | ✓ | `真` / `假` / `说不清` |
| `entities` | ✓ | ≥ 1 |
| `sources` | ✓ | ≥ 1 |
| `why_nini` | ✓ | |
| `notes` |  | |
| `allow_repeat` |  | |

### 3.3 NewsCard（环球小报）

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✓ | 如 `n-2026-11-30-orca` |
| `url` | ✓ | 主来源 URL（新闻原文） |
| `published` | ✓ | `YYYY-MM-DD`，距出刊日 ≤ 7 天 |
| `event` | ✓ | 一句话事件描述（规范化，用于同事件去重） |
| `entities` | ✓ | ≥ 1 |
| `title_hint` | ✓ | 建议标题 |
| `angle` | ✓ | 切入角度 / 讲给孩子的点 |
| `photo` |  | 照片 URL 或方向；有视频写 `video` |
| `why_nini` | ✓ | |
| `followup_of` |  | 同一事件有新进展时写旧新闻的 URL，允许实体重复 |
| `allow_repeat` |  | |

数量：`ready` 时 `news` 条数 = 本期新闻版面需要的条数（按 `magazine.yaml` 的 `params.news.layout`：`poster` 2 条，`classic` 3 条；实现时以 `sections/news` 的实际要求为准）。

### 3.4 plan-check

```bash
node .engine/scripts/pipeline.mjs plan-check plan/2026-W49.json
```

检查（错误 = 退出码 2；警告只打印）：
- 结构：字段齐全、类型对、字数（问题 ≤ 24、说法 ≤ 30）、日期在本周内、`id` 全局唯一（跨所有 plan 文件和总账）。
- `ready` 的一天：cover 必有；本期出 check 时 check 必有；news 条数够、`published` 在出刊日前 7 天内。
- **去重**（§4）：每张卡对比总账 + 其它所有 plan 文件里**还没出刊**的卡（含同一文件里的其它天、备用卡）。
- **锁定**：某天已经开工（有 brief 的日期等于这天），这天的卡和 `brief.plan` 里的快照不一致 → 错误「已开工，不能再改」。
- 主编推送 plan 之前必须跑过 plan-check 并通过。

## 4. 题目总账与去重：`state/topics.jsonl`

一行一条，只追加：

```json
{"issue": 24, "date": "2026-11-05", "section": "cover", "id": "c-leonids", "title": "流星又不会看日历，为啥年年11月准时来？", "entities": ["狮子座流星雨", "坦普尔-塔特尔彗星"], "mechanism": "彗星碎屑带", "event": null, "url": null, "source": "archive"}
```

- `section`：`cover` | `check` | `news`（可扩展 `creature`、`think`）。今日一问和封面同一张卡，只记 cover。
- `title`：cover 记问题（去标签），check 记说法，news 记标题。
- `url`：news 的主来源；cover/check 为 null。
- `event`：news 的事件描述；其它为 null。
- `source`：`archive`（第 90 步追加）| `backfill`（历史补录）。
- 出刊才进总账；plan 里还没出刊的卡不进总账，plan-check 单独比对。

### 4.1 规范化

- 实体、机制：去空格和标点、英文转小写；`state/topic-aliases.json`（可选）`{"旅行者1号": ["旅行者一号", "voyager 1", "voyager1"]}` 把别名映射到同一个规范名。
- 文本相似：去标签、去空格标点后，两段文本有连续 N 个字相同即视为"相似"（复用 pipeline-lib 里 `shares` 的写法）。

### 4.2 窗口（引擎默认值；`magazine.yaml` 可用 `dedupe:` 覆盖同名键）

| 键 | 默认 | 规则 | 级别 |
|---|---|---|---|
| `news_url` | 永久 | 新闻主来源 URL（及 news.json 的 `sources` 里任一 URL）出现过 | 错误 |
| `news_event` | 永久 | 事件描述相似（连续 10 字）| 错误 |
| `news_entity_days` | 21 | 同一实体 21 天内出过新闻，且没写 `followup_of` | 错误 |
| `claim` | 永久 | 真的假的说法相似（连续 8 字）| 错误 |
| `question` | 永久 | 封面问题相似（连续 10 字）| 错误 |
| `same_section_entity_days` | 30 | 同栏目同实体 30 天内出现过（cover↔cover、check↔check）| 错误 |
| `cross_section_entity_days` | 14 | 不同栏目同实体 14 天内出现过 | 警告 |
| `mechanism_days` | 45 | cover 的机制 45 天内讲过 | 错误 |
| `title_fuzzy_days` | 30 | 历史条目没有实体时，标题相似（连续 6 字）| 警告 |

- 卡写了 `allow_repeat` → 错误降为警告，警告里带上理由。
- 日期按出刊日（plan 的那一天 / brief 的日期）计算。

### 4.3 拦截点

1. `plan-check`（主编推送前）。
2. `pipeline.mjs check`（执行出稿后）：对本期 cover/check/news 的**实际输出**做去重（排除本期自己在总账里的条目）。这样执行自选、或没走选题卡时也被拦住。
3. 任务单（ticket）：cover、comic、check、news 的任务单里打印"近期用过"清单（窗口内的实体、机制、新闻 URL/事件、永久的说法和问题取最近 60 条），模型不用自己翻旧期。

### 4.4 历史补录

```bash
node .engine/scripts/topics.mjs backfill [--write]
```

从 `issues/NNN/issue.json`（和 `issues/legacy/*.json`）机械提取 cover 问题、check 说法、news 标题和 URL，`entities` 留空；默认只打印，`--write` 写入（已存在的同期同栏目条目跳过）。实体和机制由 agent 读稿补齐（第一次部署时做一次）。

## 5. 执行照卡出刊

### 5.1 快照进任务书

`pipeline.mjs schedule <issue> <date>`（第 00 步）读 `plan/<date 所在周>.json` 里这一天，把它**原样快照**进 `brief.json`：

```jsonc
"plan": {
  "week": "2026-W49", "date": "2026-11-30", "status": "ready",
  "cover": {…}, "check": {…}, "news": […],
  "fallback": []          // 降级记录，见 5.3
}
```

没有选题卡时写 `"plan": {"week": …, "date": …, "status": "missing", "fallback": []}`。重跑 schedule 时已有的 `plan` 原样保留（快照一旦写入就锁定；要换卡只能走 5.3 的 fallback 命令）。

`brief.md` 的 `topic_hint` 在有卡时直接取 cover 卡的 question。

### 5.2 任务单带卡、check 核对

- cover、comic 的任务单打印 cover 卡全文，标题「选题卡（照写，不换题）」；check、news 同理。卡也进任务单指纹。
- `pipeline.mjs check` 增加**忠于选题卡**：
  - `cover.json` 的 `question.zh` 去标签空白后 = 卡的 `question` 去标签空白后；
  - `check.json` 的 `claim` = 卡的 `claim`（同样规范化）；
  - `news.json` 每条 `items[].sources` 里必须包含某张卡的 `url`，一张卡只能对应一条；
  - `plan.status` 为 `missing` 时不核对忠实度，只做去重。

### 5.3 降级：不换题，换备用卡

执行核实不了卡（来源打不开、数字对不上、找不到能用的照片）时不能自己换题：

```bash
node .engine/scripts/pipeline.mjs plan-fallback issues/NNN cover "<原因>"
node .engine/scripts/pipeline.mjs plan-fallback issues/NNN check "<原因>"
node .engine/scripts/pipeline.mjs plan-fallback issues/NNN news <卡 id> "<原因>"
```

- cover/check：从本周 `spares` 里取第一张**没被用过**（没进总账、没被别的 brief 用过）且**通过去重**的备用卡，替换 `brief.plan.cover/check`，在 `brief.plan.fallback` 追加 `{"section","from","to","reason","at","by"}`。没有可用备用卡 → 把这一栏标成自选（`"to": "free"`），忠实度不再核对这一栏，去重照样。
- news：把那张卡标成作废（`"to": "free"`），执行可以自己找一条替代新闻，忠实度核对时该卡不再要求出现，但多出来的那条照样去重。
- 每次降级都要在出刊通知里写出来（§8）。
- 执行不能改 `plan/*.json`。

## 6. 第 90 步追加总账

`pipeline.mjs archive` 额外把本期 cover、check、news 追加进 `state/topics.jsonl`（`source: "archive"`），实体/机制/事件取自 `brief.plan` 的卡（降级为自选的栏目取不到就留空，靠标题相似兜底），并把 `state/topics.jsonl` 写进归档回执的 `updated`。同一期同栏目已存在则不重复追加。

## 7. 主编的两个任务（详见 roles/editor.md）

**weekly-plan**（每周一次，`run.sh` 发现下一周没有 plan 时）：
1. 做本周策展（SKILL.md「做本周策展」），结论直接生效（只周知家长，不等确认）；涉及修改 `MY_CHILD.md` 的仍只写建议。
2. 读 `profile.md`、`curation-log.md`、`child-questions.md`、`feedback.jsonl`、近期总账（`topics.mjs recent`）、`core/rules/topic-quality.md`，排这一周每天的 cover、check 卡（按 `magazine.yaml` 的周节奏和栏目），外加 spares。
3. 新闻在周排时不填（定稿时再挑）。
4. `plan-check` 通过 → `sync.sh push "plan: 2026-W49"` → 生成通知（§8）发给家长。
5. 接着做明天的 finalize。

**finalize**（每晚，明天还不是 ready 时）：
1. 处理插入的变更：`child-questions.md` 新问题、`curation-log.md` 随手记里家长的新要求、家长直接发给主编的话 → 改明天的卡，写进 `revised`。
2. 搜新闻：最近 7 天，按 topic-quality 和 sections/news 的选题规则挑够条数，写 NewsCard。
3. 自查每张卡的来源能打开、数字核对过。
4. 标 `ready` → `plan-check` → `sync.sh push "plan: 2026-11-30 定稿"` → 通知。

## 8. 通知：`scripts/notify.mjs`

引擎只生成文本，agent 用自己的渠道发给家长；没有渠道就在任务总结里原样输出。

```bash
node .engine/scripts/notify.mjs plan <YYYY-Www>        # 周排好了：每天一行（日期 星期｜封面问题｜真的假的），外加备用卡
node .engine/scripts/notify.mjs finalize <YYYY-MM-DD>   # 定稿：封面问题、新闻标题；revised 里的变更和原因
node .engine/scripts/notify.mjs issue <issues/NNN>      # 出刊：期号日期、网盘位置 成品/NNN/、没完成的步骤、fallback 降级记录、review.md 里「值得家长看」的段落（没有就省略）
```

另外 `run.sh` 在分派时发现的异常（选题没定稿、没有选题卡、锁被占用、拉取失败）直接在 `NOTIFY:` 段输出。

输出格式：纯文本，第一行是标题（如 `📅 下周选题已排好（2026-W49）`），不超过 25 行，不含孩子以外的隐私。

## 9. 改动清单

引擎（kids-magazine-kit）：
- 新增 `scripts/topics.mjs`（总账读写、规范化、去重、`backfill`、`recent` CLI）
- 新增 `scripts/plan.mjs`（plan 读取、卡结构校验、plan-check、fallback）
- 新增 `scripts/next.mjs`、`scripts/run.sh`（角色分派、锁）
- 新增 `scripts/notify.mjs`
- 改 `scripts/pipeline.mjs`（`plan-check`、`plan-fallback` 命令）、`scripts/schedule.mjs`（快照 brief.plan）、`scripts/ticket.mjs`（卡 + 近期用过清单）、`scripts/pipeline-lib.mjs`（check 忠实度 + 去重；archive 追加总账）
- 新增 `roles/editor.md`、`roles/producer.md`、`core/rules/topic-quality.md`
- 改 `SKILL.md`（新增「角色」一节）、`pipeline/README.md`、`pipeline/stages/{brief,cover,comic,check,news,archive}.md`
- `templates/data/`：`plan/.gitkeep`、`state/topics.jsonl`（空）、`.gitignore` 加 `.agent.yaml`
- `examples/demo/` 补一份示例 plan 和 topics.jsonl（测试用）
- 测试：`tests/topics.test.mjs`、`tests/plan.test.mjs`、`tests/next.test.mjs`、`tests/notify.test.mjs`，并保证原有测试全部通过（`node --test tests/*.test.mjs`）

数据仓库（kids-magazine）：
- `state/topics.jsonl`：001–024 期补录（实体、机制、事件补齐）
- `state/topic-aliases.json`
- `.gitignore` 加 `.agent.yaml`
- `CLAUDE.md`/`AGENTS.md`：说明角色配置和 `run.sh`
- `.claude/session-start.sh`：打印本机角色，提示跑 `run.sh`

## 实现备注

- `--date` 省略时取本机日期，ISO 周和去重窗口按日历日计算，窗口含最后一天。备用卡一周内都可使用，周排检查按该周离对比日期最近的一天算，实际换卡按出刊日算。
- 新闻条数按 `sections/news/check.mjs` 的区间校验。海报版 1–3 条，经典版 2–3 条，本期没排环球小报就是 0 条。草稿未选足的新闻由执行补齐，已有的新闻卡仍须采用。示例周排的发布日期是测试值，沿用第 003 期的旧稿来源。
- `topic_hint` 写入引擎现用的 `brief.json`。快照连同 `revised` 和 `notes` 保留，第一次降级把原快照的摘要记在 `brief._meta.plan_hash`，主编之后仍对原周排校验。卡 id `free` 保留给降级用。总账里的同一张已出刊卡与它在周排里的原卡合计一次 id。
- 新闻总账的 `url` 存主来源，另有来源时用可选的 `urls` 保留。URL 去重忽略锚点，保留查询参数。跟进只放行实体窗口，同 URL 和同事件仍拦截。没卡时，出稿检查也会比对源稿自带的主题字段，归档只保留实际标题、新闻来源和卡上可用的结构化信息。
- `dedupe` 的天数键可覆盖为非负整数（0 表示当天）。默认永久的键接受 `true`、`false` 或非负天数。任务单按栏目显示窗口内的记录，永久说法和问题各列最近 60 条。历史补录默认打印待追加的 JSONL，`recent` 打印 JSON，可选传入查询日。
- 出刊分派用源稿和有效归档回执判断已完成，方便在没有本机页图的克隆使用。锁用实时钟和该期期号目录最近一次提交的时间算 6 小时。锁的推送遇到上游更新时，先撤回本次锁提交并拉取。上游已有有效锁就输出 `blocked`，只遇到无关更新就按新状态重试一次。
- 去重是词面和窗口检查，来源真实性和语义相近的改写仍由主编和执行核实。历史补录的实体、机制和事件由人工补齐，归档前也仍须核对网盘。
