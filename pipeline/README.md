# 流水线：一期杂志怎么分步做

一期杂志拆成 20 步，每步只读上游文件、写自己的输出。家长说"做第 10 步"，agent 读对应的说明，写出文件就结束。一次由一个 agent 出刊，它可以派子 agent 并行做互不依赖的步骤。

## 目录

**数据目录**（下文写作 `data/`）放孩子的全部资料，是家长的一个私有 git 仓库，存源稿和档案。`40-cards/`、`60-audio/`、`70-final/` 是产物，留在本机、不进 git（数据目录的 `.gitignore` 挡着）；发给孩子的成品放网盘 `我的云端硬盘/<刊名>/成品/`。

**目录固定**：下面的文件夹名和文件名都照抄。不新建别的文件夹、不改名、不按日期另起目录；期号一律三位数（`007`）。

```
<私有数据仓库>/               数据目录，下文写作 data/
  magazine.yaml             杂志配置：出哪些栏目、哪天出、周五轮换、参数（可选，没有就用默认配置）
  MY_CHILD.md  profile.md  curation-log.md  letters.md  child-questions.md
  story-bible.md  serial-bible.md  creature-log.md  think-log.md  thinking-plan.md  vocab.json  feedback.jsonl
  voices/azure.json         讲读版每个角色用哪个 Azure 声音（可选，没写的用默认）
  voices/polyphones.json    这个孩子常用词的多音字读音（可选，补充引擎的通用词典）
  sfx/                       讲读版音效（可选）
  issues/
    007/                     本期工作区，下文写作 issue/
      00-brief.json
      08-think.json（周五）  09-creature.json（周一）  10-cover.json  11-comic.json  11-diagram.svg  12-words.json  13-story.json
      14-puzzle.json  15-english.json  16-mailbox.json  17-news.json  18-serial.json  19-check.json
      20-assets/             cover.jpg、creature.jpg 和 creature-legend.jpg（周一）、news-1..3.jpg、check.jpg 和 think.jpg（有配图时）、serial.jpg（折纸是 step-1..N.png，切不开时用 serial-diagram.png）、assets.json
      30-issue.json          合并后的整期
      30-build.json          合并输入和输出的版本记录
      31-review.md
      40-cards/              card-1..N.png（平时 8 张，周一、周五 9 张）、<刊名>-第007期.pdf（不进 git）
      50-narration.json
      60-audio/              c{card}_{序号}.wav、manifest.json（不进 git）
      70-final/              <刊名>-第007期.pdf、讲读版.mp4（不进 git）
  成品/                      不进 git，上传到网盘 我的云端硬盘/<刊名>/成品/
    007/                     发给孩子的成品，文件名固定：
                             card-1.png … card-N.png
                             <刊名>-第007期.pdf
                             <刊名>-第007期-讲读版.mp4
```

**同步**：用 `scripts/sync.sh`（在数据目录里运行）：

```bash
sh .engine/scripts/sync.sh start                     # 开工前：拉最新，打印最新一期的进度
sh .engine/scripts/sync.sh push "007: 出刊"           # 一期做完第 90 步推送一次；档案、反馈、随手记也用它
sh .engine/scripts/sync.sh check                     # 有没提交或没推送的改动时返回 1
```

第 40、70 步出了成品，按上面的文件名传到网盘 `成品/NNN/`。

## 步骤

| 步 | 做什么 | 依赖 | 类型 |
|---|---|---|---|
| 00 | 本期任务书 | — | agent |
| 08 | 周末思辨（只在周五） | 00 | agent |
| 09 | 传说怪物档案（只在周一） | 00 | agent |
| 10 | 封面选题 | 00 | agent |
| 11 | 今日一问（漫画 + 图解） | 10 | agent |
| 12 | 单词屋（可选，暂停） | 00 | agent |
| 13 | 小剧场 | 00 | agent |
| 14 | 谜题 | 00 | agent |
| 15 | 英文三关（可选，暂停） | 00 | agent |
| 16 | 信箱 | 00 | agent |
| 17 | 环球小报 | 00 | agent |
| 18 | 经典连载 | 00 | agent |
| 19 | 真的假的 | 00 | agent |
| 20 | 下载图片 | 08、09、10、17、18、19 | agent |
| 30 | 合并整期 | 08、09、11、13、14、16、17、18、19、20（做了 12、15 也一起合并） | 脚本 |
| 31 | 审稿 | 30 | agent |
| 40 | 渲染图片和 PDF | 31 | 脚本 |
| 50 | 讲读稿 | 31 | agent |
| 60 | 语音 | 50 | 脚本 |
| 70 | 讲读视频 | 40、60 | 脚本 |
| 90 | 更新档案 | 40 | agent |

00 完成后，08、09、10、12、13、14、16、17、18、19 可以同时开工。`stages.json` 里每个栏目步骤带 `section`（栏目 id）；任务书的 `sections` 里没有这个栏目，这一步 `status` 显示「本期不出」、算作完成。`sections` 由第 00 步的 `pipeline.mjs schedule` 按 `data/magazine.yaml` 写：默认 09 只在周一、08 只在周五，12 单词屋、15 英文三关要在 `magazine.yaml` 的 `sections` 里列出才做。没有 `sections` 的旧任务书照旧看 `creature`、`think` 两个字段。完整定义见 `stages.json`。

## 两种用法

- **指定一步**：家长说"做第 10 步"，agent 只做这一步（见下文"接手一步的做法"）
- **走完全程**：家长只说"出下一期"，当前 agent 从 00 一直做到 90，已经存在的输出视为完成、从缺的那步接着做；做法见 SKILL.md「没有指定步骤时：一个 agent 走完全程」

## 接手一步的做法

0. 在数据目录里跑 `sync.sh start` 拉最新
1. 读 `pipeline/stages/<步骤>.md`（公开地址：`https://raw.githubusercontent.com/jevejoze/kids-magazine-kit/main/pipeline/stages/<步骤>.md`）
2. 确认依赖步骤的输出文件都在 `issue/` 里；缺了就停下，告诉家长先做哪一步
3. 栏目步骤和第 50 步领任务单：`node scripts/pipeline.mjs ticket <issue> <栏目>`（栏目 id、步骤 id 或 `narration`）。单上有这一步要守的规则（内容红线总在）、角色槽位、任务书字段、本期参数、状态文件、上游值和输出路径
4. 读说明里列出的输入，写出说明里规定的输出文件，字段名照抄
5. 每个输出 JSON 顶层写 `"_meta": {"stage": "13-story", "by": "<agent 名称>", "at": "<ISO 时间>", "ticket": "<任务单指纹>"}`
6. 按说明里的"自检"逐条检查
7. 交付；推送等这一期做完第 90 步一起做
8. 只写自己这一步的输出；发现上游有错，写进自己输出的 `_meta.issues`，交给家长决定

重做某一步：直接覆盖它的输出，再把依赖它的下游步骤重做一遍。

## 校验与完成状态

- JSON 的结构契约和页面顺序在 `scripts/contracts.mjs`，编辑字数、角色等检查在 `scripts/pipeline-lib.mjs`。`check` 检查已有文件，适合制作到一半时使用；`assemble` 还会要求全部必做内容和素材齐全。缺文件、结构错误或编辑检查失败时返回非零退出码，不覆盖上一次的 `30-issue.json`。
- 合并只检查上游内容。旧审稿写着「需修改」、旧讲读稿不合格时，仍可修订内容并重新合并。重新合并后必须重新审稿。
- 审稿完成要求独立一行 `结论：通过` 和 `内容指纹：<SHA-256>`，指纹必须对应当前内容。图片阶段要求全部页图和 PDF 非空；语音阶段要求每句音频及对应 manifest 条目齐全；视频阶段要求 MP4 和 PDF 非空。同时核对输入指纹和每个输出文件的 SHA-256，不能代替图片视觉检查或音视频播放验收。
- 正式渲染要求内容步骤齐全、校验通过、审稿通过。审稿前的预览，以及没有分步文件的旧格式期刊，显式加 `--preview`；预览会列出结构问题作为提示，照常出图。
- 合并产生 `30-build.json`；图片、语音、视频目录各产生 `build.json`。内容、图片、声音配置、相关制作脚本或输出文件变更后，相关产物会被判为过期。未记录版本的旧产物也必须重新制作，不能仅补一份通过结论冒充重做。
- 第 31 步先检查当前合并内容，再运行 `node scripts/pipeline.mjs fingerprint <issue>`，将指纹填入审稿记录。内容变化后必须重新审稿；第 50 步写稿前也读取这个指纹，放入 `_meta.content_hash`。
- 第 40、70 步先在临时目录生成，完成后替换成品；失败保留上一版，页数变少时清掉多余旧页，目录里的其他笔记会保留。预览不生成正式制作记录。
- 语音每完成一句就原子保存 manifest，失败后重跑同一命令可复用已完成的句子；`--dry` 不创建音频目录或制作记录。
- 输出写了 `_meta.ticket` 时，指纹要和当前任务单一致：任务书字段、本期参数、规则文件、cast 或上游值变了，`status` 把这一步标成过期，`check` 报「任务单变了」，合并也会停下。没写 `_meta.ticket` 的旧输出照旧有效。
- 过期检测覆盖合并、审稿、讲读及脚本产物，不会自动改写 agent 撰写的各栏目。封面换题后是否重写漫画，仍需编辑按依赖判断。

```bash
node scripts/render.mjs <issue>/30-issue.json <issue>/40-cards --flat --preview
node --test tests/*.test.mjs
```

## 脚本步骤

30、40、60、70 需要运行脚本，在任意有 Node 22+、Chrome、Python 3、ffmpeg 的环境里跑（Claude Code 云端会话、自己的电脑都可以）：

```bash
node scripts/pipeline.mjs schedule <issue> [YYYY-MM-DD]  # 第 00 步：按 magazine.yaml 算本期栏目，写进任务书
node scripts/pipeline.mjs status   <issue>   # 看每步做了没有、下一步能做什么
node scripts/pipeline.mjs ticket   <issue> <栏目>   # 领任务单，指纹写进输出的 _meta.ticket
node scripts/pipeline.mjs check    <issue>   # 检查已完成步骤的字段和字数
node scripts/assets.mjs   fetch|trim|slice … # 第 20 步：下载图片、折纸图式裁边与切步骤
node scripts/pipeline.mjs assemble <issue>   # 第 30 步
node scripts/pipeline.mjs fingerprint <issue> # 第 31、50 步记录当前内容指纹
node scripts/render.mjs <issue>/30-issue.json <issue>/40-cards --flat   # 第 40 步（版面溢出会打印警告）
node scripts/tts_azure.mjs <issue> --pinyin  # 第 60 步之前：列出没注音的多音字
node scripts/tts_azure.mjs <issue>           # 第 60 步（Azure 语音）
node scripts/tts_voicestudio.mjs <issue>     # 第 60 步之后（可选）：数据目录有 voices/voicestudio.json 时换成克隆声音
node scripts/tts_mimo.mjs <issue>           # 第 60 步（MiMo 语音）：数据目录有 voices/mimo.json 时用它代替 Azure，之后照样跑 tts_voicestudio.mjs
node scripts/tts_elevenlabs.mjs <issue>     # 第 60 步之后（可选）：数据目录有 voices/elevenlabs.json 时把编辑部成员换成 ElevenLabs，在 tts_voicestudio.mjs 之前跑
python3 scripts/make_video.py <issue>        # 第 70 步
node scripts/pipeline.mjs script   <issue>   # 没有语音合成时：导出 70-final/家长讲读稿.md
node scripts/pipeline.mjs archive  <issue>   # 第 90 步助手：追加档案、整理 成品/NNN/
```

第 60 步默认用 Azure 语音（`scripts/tts_azure.mjs`），需要环境变量 `AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`；数据目录有 `voices/mimo.json` 时改用小米 MiMo（`scripts/tts_mimo.mjs`，环境变量 `MIMO_API_KEY`）；换别的语音服务也行，按 `stages/60-audio.md` 的约定把音频放好即可。
