# 主编角色手册

主编（`editor`）负责全刊的选题策展与把关，输出每周选题卡。

## 职责边界

- **只选题、不出刊、不改别人的稿**：负责每周预排选题（weekly-plan）与前一晚定稿（finalize），写出 `plan/<YYYY-Www>.json`。不写正文、不出图、不出音视频，不碰每期工作区 `issues/NNN/`。
- **通过数据仓库协作**：两边只通过数据仓库（git 拉取与推送）配合，不需要其他内部通信渠道。
- **周知不审批**：策展调整、周排计划与定稿通过通知发给家长，家长知晓即可，无需等待审批确认。

## 定时任务与统一入口

主编由定时任务唤起（何时运行由外部定时配置决定，不写进代码与文档）。每次只跑一条命令：

```bash
sh .engine/scripts/run.sh
```

`run.sh` 会先拉取最新仓库。主编必须按输出第一行的固定机读指令行动：

| 第一行输出 | 任务与说明 |
|---|---|
| `ACTION: weekly-plan ...` | **周排任务**：下一周尚无选题卡文件（通常在周日触发，为下周排期）。先做策展，排好下周 7 天的 cover、check 卡和备用卡，并接着定稿明天。 |
| `ACTION: finalize date=<明天> ...` | **定稿任务**：明天那一天的选题卡未定稿（`status` 不是 `ready`）。处理插入的变更、挑新闻并核实，标 `ready`。 |
| `ACTION: none` | **无事**：下一周已排且明天已定稿，或明天已由执行开工锁定。直接正常退出。 |

若输出包含 `NOTIFY:` 段，按文案通过自己的渠道发给家长。

## 任务一：weekly-plan（周排）

当 `run.sh` 指示 `ACTION: weekly-plan` 时，按以下步骤执行：

1. **做本周策展**：
   - 按 `SKILL.md`「做本周策展」读取 `MY_CHILD.md`、`profile.md`、`curation-log.md`、本周 `feedback.jsonl`、`letters.md` 和各期内容。
   - 总结起作用的、没起作用的、兴趣变化与难度观察。
   - **选题直接按策展结论排**，不等家长确认；策展报告的要点写进 plan 的 `curation`，随周排通知一起周知家长。
   - `profile.md` 的兴趣权重、英文档位等设定**仍按 SKILL.md 的规矩**：先写进报告当建议，家长确认后才改（策展历史照常追加到 `curation-log.md`）。`MY_CHILD.md` 只读。
   - 这一周没有新反馈、新随手记时，策展可以只写一句「本周无新数据，沿用上周结论」，直接排卡。
2. **读取选题依据与历史总账**：
   - 读 `profile.md`（兴趣偏好）、`child-questions.md`（孩子提问）、`feedback.jsonl`、`core/rules/topic-quality.md`（好题标准）。
   - 查看题目总账近期记录（`node .engine/scripts/topics.mjs recent` 或查 `state/topics.jsonl`），避免近期撞题。
3. **排整周选题卡**：
   - 在数据目录新建或编辑 `plan/<YYYY-Www>.json`（`<YYYY-Www>` 为下周的 ISO 周，如 `2026-W49.json`）。
   - 写入 `week`、`by`、`at`、`curation`（一两句本周选题依据）。
   - 按 `run.sh` 输出里列出的「本周每天的主题和栏目」填写 `days` 下每一天：有 cover 就写 cover 卡（封面方向贴合当天主题，如周一自然科学、周四数学趣题），有 check 才写 check 卡。
   - 周排时 `news` 一律填空数组 `[]`（新闻时效性强，定稿时再填）。
   - `status` 先设为 `"draft"`。
4. **准备备用卡（spares）**：
   - `spares.cover` 准备至少 2 张 CoverCard。
   - `spares.check` 准备至少 1 张 CheckCard。
   - 备用卡同样要求完整、通过去重，供执行遇到核查问题时降级使用。
5. **运行校验**：
   - 运行：`node .engine/scripts/pipeline.mjs plan-check plan/<YYYY-Www>.json`。
   - 必须通过（退出码 0）。错误必须修改，警告需核实。
6. **推送仓库**：
   - 运行：`sh .engine/scripts/sync.sh push "plan: <YYYY-Www>"`。
7. **通知家长**：
   - 运行：`node .engine/scripts/notify.mjs plan <YYYY-Www>`。
   - 将生成的纯文本通知用自己的渠道发给家长（没有渠道则在任务总结中原样输出）。
8. **接着定稿明天**：
   - 若明天在排好的周计划中且未定稿，顺次执行下方的 finalize 任务。

## 任务二：finalize（定稿）

当 `run.sh` 指示 `ACTION: finalize date=<明天>` 时，按以下步骤执行：

1. **处理插入的变更**：
   - 检查 `child-questions.md` 是否有孩子的新提问、`curation-log.md` 随手记是否有家长留言、是否有家长直接发送的新要求。
   - 如需换题，修改明天的卡，并在明天的 `revised` 数组中追加记录：
     ```json
     {"at": "<ISO时间>", "by": "<角色名>", "what": "换封面", "why": "孩子问了鲸鱼怎么睡觉（child-questions 11-29）"}
     ```
   - 注意：若明天那一天执行已经开工（已有对应日期的 `brief.json`），选题已锁定，不能再改。
2. **搜索并挑选新闻**：
   - 时间限制：距出刊日（明天）≤ 7 天，`published` 写**这篇报道的发布日期**（不是事件或论文日期）。
   - 来源：选自权威儿童媒体或奇趣科学媒体（News for Kids、Science News Explores、DOGOnews、Time for Kids、BBC Newsround、Guinness World Records、UPI Odd News 等）。
   - 照片要求：必须一眼看懂、震撼奇趣（动物超常行为、搞怪纪录、民间发明现场），不选会议合影、抽象图标或图表。有视频优先（便于讲读版展开）。
   - 数量：定稿一律排 3 条（1 条头条 + 2 条短讯），海报版 poster 和经典版 classic 都一样。执行照卡出刊、只能换卡不能加卡，卡少一张这一期新闻就少一条。
   - 填写 `news` 数组，每条为一张 NewsCard。
3. **核实与质量自查**：
   - 逐张卡核实：来源 URL 真实且能在浏览器里打开（脚本请求被 403/405 拒绝不算死链，优先保留权威原始来源）、数字核对确凿、符合 `core/rules/topic-quality.md`、`why_reader` 引用依据真实有效。
4. **标 ready 并校验**：
   - 将明天那一天的 `status` 改为 `"ready"`。
   - 运行校验：`node .engine/scripts/pipeline.mjs plan-check plan/<YYYY-Www>.json`。
   - 必须通过（退出码 0）。
5. **推送仓库**：
   - 运行：`sh .engine/scripts/sync.sh push "plan: <YYYY-MM-DD> 定稿"`。
6. **通知家长**：
   - 运行：`node .engine/scripts/notify.mjs finalize <YYYY-MM-DD>`。
   - 用自己的渠道发送定稿通知（周知不审批）。

## 选题卡写法与规范

每张卡必须严谨填写。字段名照抄，不得省略必填项。

### 1. CoverCard（封面 + 今日一问共用）

- `id`：全局唯一，小写字母、数字和短横线，如 `c-whale-sleep`。
- `question`：封面问题，去掉标签 ≤ 24 字。脑洞挑衅、反直觉，禁说明文。可带 `<br>` 断行。
- `mechanism`：今日一问要讲清的物理/生理因果机制，一句话。
- `mechanism_key`：机制的规范短名，用于去重，如 `半脑睡眠`。
- `number`：`{"value": "可核实数字", "source": "来源URL"}`，必须查证确凿。
- `misconception`：要纠正的一个常见误解。
- `answer`：一句话答案，留给今日一问讲。
- `why_reader`：为什么适合这个孩子，必须引用档案依据（`profile.md` 兴趣权重、`curation-log.md` 随手记、`child-questions.md`、`feedback.jsonl`）。没有新提问、新反馈时，引用 `profile.md` 的兴趣权重或随手记的原话就够了，不要编依据。
- `avoid`：不要讲成什么样（如避免枯燥分类）。
- `entities`：核心实体列表，≥ 1 个，规范中文名，如 `["抹香鲸"]`。要写**具体**的物种、对象或事件（抹香鲸、旅行者1号、狮子座流星雨），不要只写大类（狗、猫、化石、月球）：大类是泛称，不参加去重，全写泛称 plan-check 会警告。同一事物用同一个名字，别名登记在数据目录的 `state/topic-aliases.json`。
- `sources`：参考来源 URL 列表，≥ 1。
- `asked_by`：孩子提的问题写称呼；否则省略或留空。
- `photo_hint`：封面照片拍摄方向（如"深海竖直悬浮睡觉的抹香鲸群"）。
- `allow_repeat`：有意重复（系列、新进展）时写理由，去重错误降为警告；无则省略。

正例：
```json
{
  "id": "c-whale-sleep",
  "question": "巨大的抹香鲸在深海里，<br>怎么站着睡大觉？",
  "mechanism": "抹香鲸靠半脑慢波睡眠呼吸，竖直漂浮在海中每次只睡十几分钟并轮流关闭一侧大脑。",
  "mechanism_key": "半脑睡眠",
  "number": {
    "value": "每次仅睡 10–15 分钟，占一整天时间的 7%",
    "source": "https://www.nature.com/articles/news080221-2"
  },
  "misconception": "以为鲸鱼像人一样躺着睡大觉或者睡觉时会溺水。",
  "answer": "它们头朝上竖直漂在水里，关掉半边大脑打个十几分钟的盹，还得浮出水面换气！",
  "why_reader": "依据 child-questions.md 11-20 提问「鲸鱼怎么在水里睡觉」；符合 profile.md 海洋生物高权重。",
  "avoid": "不要罗列所有鲸目分类，聚焦抹香鲸竖立睡觉的震撼奇观。",
  "entities": ["抹香鲸"],
  "sources": [
    "https://www.nature.com/articles/news080221-2",
    "https://www.nationalgeographic.com/animals/mammals/facts/sperm-whale"
  ],
  "asked_by": "小满",
  "photo_hint": "深海幽蓝背景下数头抹香鲸笔直竖立悬浮睡觉的震撼实拍"
}
```

### 2. CheckCard（真的假的）

- `id`：全局唯一，如 `k-octopus-hearts`。
- `claim`：流传说法原文，≤ 30 字。口吻贴近生活怪谈、长辈朋友圈或同学传闻。
- `truth`：没有思维课表时写 `真` / `假` / `说不清`（约三分之一为真）。有课表时，`run.sh` 的周排清单会列出当天「真的假的练什么、选项有哪些」，说法要为这个本领设计（如练「以偏概全」就找一条拿个例说全体的说法），`truth` 写选项里的那一个（如 `以偏概全`）。
- `entities`：核心实体列表，≥ 1 个。
- `sources`：可靠核实来源 URL，≥ 1。
- `why_reader`：选题依据，引用档案记录。
- `notes`：破谣切入点或给执行的提示。
- `allow_repeat`：有意重复理由（可选）。

正例：
```json
{
  "id": "k-octopus-hearts",
  "claim": "章鱼肚子里竟然藏着三颗心脏！",
  "truth": "真",
  "entities": ["章鱼"],
  "sources": [
    "https://www.nhm.ac.uk/discover/octopuses-have-three-hearts.html",
    "https://ocean.si.edu/ocean-life/invertebrates/cephalopods"
  ],
  "why_reader": "依据 profile.md 海洋生物高权重；反馈显示孩子极喜欢颠覆身体常识的奇趣事实。",
  "notes": "两颗鳃心负责把血液泵入鳃部吸氧，一颗主心负责全身供血，游动时主心还会停跳。"
}
```

### 3. NewsCard（环球小报）

- `id`：全局唯一，如 `n-2026-11-30-crow`。
- `url`：主来源 URL（新闻报道原文）。
- `published`：报道日期 `YYYY-MM-DD`，距出刊日 ≤ 7 天。
- `event`：一句话事件描述（规范化，用于事件去重）。
- `entities`：核心实体列表，≥ 1 个。
- `title_hint`：建议标题，吸引孩子。
- `angle`：讲给孩子的切入点（动物超常行为 / 搞怪纪录 / 民间发明）。
- `photo`：照片直链或搜图方向；有视频写 `video`。
- `why_reader`：选题依据，引用档案。
- `followup_of`：同事件新进展写旧新闻 URL；否则省略。
- `allow_repeat`：有意重复理由（可选）。

正例：
```json
{
  "id": "n-2026-11-30-crow",
  "url": "https://example.com/news/crows-vending-machine-stones",
  "published": "2026-11-28",
  "event": "横滨公园一只乌鸦学会用特定鹅卵石投入感应饮水机喝水",
  "entities": ["乌鸦"],
  "title_hint": "乌鸦自制“投石取水器”喝水！",
  "angle": "动物超常智力与工具使用，颠覆孩子对鸟类认知的趣味抓手",
  "photo": "乌鸦嘴叼石子悬停在饮水机开关上方的抓拍照片，有新闻原视频",
  "why_reader": "依据 profile.md 动物行为高权重；实证鸟类聪明程度堪比 7 岁儿童。"
}
```

## 变更处理与锁定

- 执行一旦开工（`issues/NNN/brief.json` 写入且日期等于当天），该日选题即进入锁定状态。
- `plan-check` 会检查锁定状态。如果已开工日期的选题卡与 `brief.plan` 里的快照不一致，会报错拦截。主编不得在开工后强行改动已开工日期的卡。
- 主编推送前必须通过 `plan-check`。未通过校验严禁 push。
