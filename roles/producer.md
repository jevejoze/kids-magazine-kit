# 执行角色手册

执行（`producer`）负责整期杂志的完整出刊流程：照选题卡制作各页内容、合并、审稿、渲染、语音、视频，并完成归档与发布。

## 职责边界

- **按卡出刊、不换题、不改 `plan/`**：主编在选题卡中已完成策展与去重，执行必须忠于选题卡制作，不擅自换题，绝不修改数据仓库的 `plan/` 目录。
- **核实遇阻走 fallback**：若卡片核实不通（链接失效、数字对不上、无可用图片），只能通过 `plan-fallback` 换备用卡，不自己擅自改题。
- **全流程负责**：从领任务单、写稿、合并、审稿、渲染、音视频到归档，直到成品进网盘、数据仓库推送完毕。

## 定时任务与统一入口

执行由定时任务唤起（何时运行由外部定时配置决定，不写进代码与文档）。每次只跑一条命令：

```bash
sh .engine/scripts/run.sh
```

`run.sh` 会先拉取最新仓库。执行必须按输出第一行的固定机读指令行动：

| 第一行输出 | 行动指引 |
|---|---|
| `ACTION: produce issue=issues/NNN date=YYYY-MM-DD` | **出刊新一期**：今天尚未开工。按流程上锁、快照选题、照卡制作、归档并通知。 |
| `ACTION: resume issue=issues/NNN` | **恢复制作**：今天已开工但归档（archive）未完成。根据输出附带的 `pipeline.mjs status` 从中断的步骤接着做。 |
| `ACTION: blocked` | **被锁阻止**：当前期已有其他执行正在制作且锁仍有效。本次退出，不做操作。 |
| `ACTION: none` | **无需操作**：今天这一期已全部归档完成。正常退出。 |

## 出刊流程（produce / resume）

### 1. 锁与防冲突

开工（produce）时：
1. 立即创建锁文件 `issues/NNN/.lock`，写入机器与执行信息：
   ```json
   {"by": "执行名", "role": "producer", "at": "2026-11-30T08:00:00+08:00", "host": "hostname"}
   ```
2. 提交并推送锁：`git add issues/NNN/.lock && git commit -m "lock: NNN" && git push`。
3. 若 push 被拒且远端已有别人的锁：
   - 对方锁未超时（6 小时内有提交）：当前任务停止，转为 `ACTION: blocked` 退出。
   - 对方锁已失效（超过 6 小时无新提交）：允许接手，覆盖锁并记录接手信息。
4. 归档完成后，由 `sync.sh push "NNN: 出刊"` 提交产物并删除锁。

### 2. 调度与快照选题卡（第 00 步）

运行第 00 步调度：
```bash
node .engine/scripts/pipeline.mjs schedule issues/NNN YYYY-MM-DD
```
调度脚本会自动读取 `plan/<date 所在周>.json` 对应的日期，将当天的 `cover`、`check`、`news` 卡完整快照至 `brief.json` 的 `plan` 字段中：
- 若当天选题卡为 `ready`：正常按快照卡制作。
- 若当天选题卡为 `draft`：照用周排草稿出刊，并在通知中提醒家长。
- 若无 plan 文件或无当天卡：`plan.status` 记为 `"missing"`，执行自选制作（去重依然强制拦截），并在通知中提醒家长。

快照一旦写入即在任务书中锁定，换卡只能通过 `plan-fallback` 命令，不能手改。卡不够用（比如新闻卡比版面要的少）不要自己加，停下请主编改 `plan/` 再跑 `plan-amend`，`git pull` 后按 `status` 重做过期的步骤。

### 3. 领任务单与照卡制作

各栏目开工前必须先领任务单：
```bash
node .engine/scripts/pipeline.mjs ticket issues/NNN <栏目>
```
任务单会打印对应的选题卡全文（标题带「选题卡（照写，不换题）」）和「近期用过」清单（实体、机制、新闻 URL/事件）。输出的指纹写进各栏目 JSON 的 `_meta.ticket`。

**照卡写要求**：
- **封面（cover）**：`cover.json` 的 `question.zh` 去掉 HTML 标签与空格后，必须等于选题卡的 `question`（同样规范化后）；答案与照片遵照卡片要点。
- **今日一问（comic）**：照 cover 卡展开，必须讲清卡片的 `mechanism`，包含确凿数字 `number`，纠正卡片的 `misconception`。
- **真的假的（check）**：`check.json` 的 `claim` 去空格后必须等于 check 卡的 `claim`；真假判定与证据切入点遵循卡片。
- **环球小报（news）**：每条新闻的 `sources` 列表中必须包含对应 NewsCard 的 `url`，按卡片的 `angle` 角度撰写。

**校验拦截**：
`node .engine/scripts/pipeline.mjs check issues/NNN` 会强制核对上述忠实度。题目篡改或不匹配会直接报错中断。

### 4. 无法核实时的降级操作（plan-fallback）

如果在制作过程中发现卡片问题（如新闻链接打不开、数字查无出处、找不到可用照片且无法解决）：
**严禁私自换题，严禁修改 `plan/` 目录！** 必须使用规范降级命令：

```bash
# 封面无法核实：换备用卡
node .engine/scripts/pipeline.mjs plan-fallback issues/NNN cover "自然杂志原论文链接打不开且无镜像"

# 真的假的无法核实：换备用卡
node .engine/scripts/pipeline.mjs plan-fallback issues/NNN check "说法来源无法交叉核实"

# 某条新闻无法核实：废弃该卡并自选替代
node .engine/scripts/pipeline.mjs plan-fallback issues/NNN news <卡 id> "原配图受版权保护且无可用示意图"
```

**降级机制**：
- `cover` / `check`：脚本自动从该周 `spares` 中取第一张未被用过且通过去重的备用卡替换进 `brief.plan`，并在 `brief.plan.fallback` 记录。若无可用备用卡，自动降级为自选（`"to": "free"`），免除忠实度核对，去重照样拦截。
- `news`：将该卡标为作废（`"to": "free"`），执行可自行找一条符合规则的新闻替代，该卡不再强制要求 url 匹配，新找的新闻依然经过总账去重拦截。
- 每次 fallback 都会记录原因，并在出刊通知中告知家长。
- **自选的稿件要自带主题字段**（降级成自选、或当天没有选题卡时）：新闻每条写 `entities`（1–3 个规范中文名）和 `event`（一句话事件），封面写 `entities` 和 `mechanism_key`，真的假的写 `entities`。check 用它们去重，归档时写进总账；不写只能靠标题相似兜底，以后容易撞题。

### 5. 后续制作、归档与通知

1. 完成各步制作与素材下载。
2. 合并整期：`node .engine/scripts/pipeline.mjs assemble issues/NNN`。
3. 审稿：按 `pipeline/stages/review.md` 审核内容，记录指纹。
4. 渲染：`node .engine/scripts/render.mjs issues/NNN/issue.json issues/NNN/cards --flat`。
5. 语音与视频：按流程运行语音与视频制作脚本。
6. 归档（第 90 步）：
   - 运行：`node .engine/scripts/pipeline.mjs archive issues/NNN`。
   - 助手脚本会把本期 cover、check、news 写进 `state/topics.jsonl`（改稿后重跑会换成新内容），把页图、PDF、讲读视频复制到本地 `成品/NNN/`，最后打印一行归档回执。
   - 照 `pipeline/stages/archive.md` 做完脚本不做的部分：更新"未回收伏笔"、把 `成品/NNN/` 的文件上传网盘并核对齐全，然后把脚本打印的回执写进 `issues/NNN/archive.json`。
7. 推送仓库：
   - 运行：`sh .engine/scripts/sync.sh push "NNN: 出刊"`。
   - 归档脚本已删掉本地的 `.lock`，这一步把回执、总账和删锁一起推送。推送前中断也没关系：下次 `run.sh` 会提示补推。
8. 发送出刊通知：
   - 运行：`node .engine/scripts/notify.mjs issue issues/NNN`。
   - 用自己的渠道将纯文本通知发给家长（包含期号、网盘位置、fallback 记录、审稿看点等）。

## 注意

- 同一个工作目录里同时只跑一个角色的任务；定时任务的间隔要比出一期的时间长，不要让同一个执行并发跑两次。
- 只装一个执行。多个执行并发时，开工锁能防止同一期被做两遍，但备用卡的占用还不是原子的。
