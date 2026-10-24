# 团子编辑部 · Kids Magazine Kit

给自己的孩子做一份**每日中英双语杂志**：AI 编辑部每天出一期，封面是一张会让孩子"咦？"的真实照片，后面是 4 格漫画讲原理、推理小剧场、奥数小谜题、环球小报、经典儿童书连载，最后一页是收反馈的信箱。适合 7–11 岁，15 分钟读完，可以发微信，也可以打印出来写。

A daily Chinese–English magazine for one child, written by an AI "editorial team" and rendered to PNG + PDF. Parents describe their kid in a questionnaire; the agent does the labour.

![示例期刊](docs/preview.jpg)

> 示例里的读者「小满」是虚构的孩子。

## 它是怎么工作的

**家长掌握对孩子的了解，AI 负责干活。**

1. 家长填一份问卷 `MY_CHILD.md`：孩子是谁、喜欢什么、想让孩子吸收什么、杂志用什么语气
2. 每一期拆成一条 20 步的**流水线**：任务书 → 封面选题、今日一问、怪物档案（周一）、小剧场、谜题、信箱、新闻、真的假的、经典连载（单词、英文三关可选） → 下载图片 → 合并 → 审稿 → 渲染 → 讲读稿 → 语音 → 视频。每步写一个中间文件，放在 Google Drive 的期刊文件夹里
3. 家长把不同的步骤交给不同的 agent：难的交给强模型，简单的交给便宜的模型，互不干扰；任何一步不满意，单独重做那一步
4. 需要跑脚本的几步（合并、渲染、语音、视频）由 agent 在有 Node、Chrome、ffmpeg 的环境里直接运行；语音默认用 Azure，免费额度每月够出 50 多期
5. 信箱页的"今日打卡"把孩子的反馈带回来，每周"做本周策展"调整下一周的方向

## 每期内容

| 页 | 内容 |
|---|---|
| 封面 | 顶部刊名条 + 大幅真实照片（刊名条取照片的颜色）+ 一个反直觉问题，编辑部成员按主题换表情和道具 |
| 今日一问 | 4 格漫画讲清一个机制 + agent 画的原理图解 + 冷知识便利贴 |
| 小剧场 | 编辑部推理连载，中文，带"侦探笔记"提问 |
| 挑战 | 奥数入门难度的逻辑谜题 + 草稿区 |
| 环球小报 | 本周 3 条适合孩子的真实新闻，照片一眼看懂，交叉核实来源；讲读版讲得最丰富 |
| 经典连载 | 公版经典儿童书一天一回（公版原版插画 + 原著英文金句 + "猜一猜接下来"）；周五换成音乐盒 / 放映室 / 动手做，介绍一首曲子、一部电影，或者带孩子折一件折纸、打印一个 3D 模型 |
| 信箱（最后一页）| 上期答案 + 5 个打卡问题：最喜欢、不喜欢、难不难、想到的问题、看到的事 |
| 讲读视频（可选）| 10–12 分钟的儿童电台节目：编辑部分角色、带情绪和音效把整期讲一遍，小剧场完整演出来，新闻配背景和尺度类比；语音默认用 Azure，也可以换成别的服务 |

## 快速开始

需要：一个各 agent 都能访问的文件夹（推荐 Google Drive），以及能读写文件的 AI agent。

1. 把 `templates/data/` 复制到 Drive，改名为你的刊名（如 `小满早知道/`），这就是**数据目录**
2. 填好 `MY_CHILD.md`
3. 对 agent 说：**"按问卷给孩子建刊"**，再说 **"做第 00 步"**
4. 之后每一步交给你指定的 agent：**"做第 10 步，数据目录在 ……"**。agent 会读 `pipeline/stages/10-cover.md` 照做
5. 内容步骤做完后，让一个能跑脚本的 agent（如 Claude Code 云端会话）做 30、40、60、70 步，成品出现在 `issues/NNN/70-final/`。第 60 步默认用 Azure 语音，先在环境里设好 `AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`

本地预览示例期：

```bash
git clone https://github.com/jevejoze/kids-magazine-kit && cd kids-magazine-kit
node scripts/pipeline.mjs status   examples/demo/issues/003
node scripts/pipeline.mjs assemble examples/demo/issues/003
node scripts/render.mjs examples/demo/issues/003/30-issue.json examples/demo/issues/003/40-cards --flat
```

常用指令：

| 说 | agent 会 |
|---|---|
| 做第 N 步 | 按 `pipeline/stages/` 里那一步的说明，写出这一步的文件 |
| 出下一期 | 一个 agent 从第 00 步做到第 90 步；已有的步骤跳过，审稿不通过就回去改，没有语音合成时出家长讲读稿 |
| 记一笔：她今天盯着封面看了很久 | 原话记进 `curation-log.md` |
| 做本周策展 | 汇总本周反馈，出调整建议，等你确认 |

## 保护孩子的隐私

孩子的名字、照片、来信、反馈都只放在**数据目录** `data/` 里，它已被 `.gitignore` 排除。

数据目录放在你自己的 Google Drive 里，只分享给你用的 agent。引擎仓库只放代码和规则。

**关于新闻图片**：新闻原图有版权。只在自家看的期刊可以用原图并署名，这些图片只能存在私有数据目录里；要公开分享的期刊只用自由授权的照片（Wikimedia Commons、NASA 等）。

## 目录

```
SKILL.md              给 agent 的总规则（AGENTS.md、CLAUDE.md 是它的软链接）
pipeline/             流水线：stages.json 步骤表、stages/ 每步说明
scripts/              pipeline.mjs（进度、检查、合并）、render.mjs（渲染）、make_video.py（视频）
assets/               页面模板、样式、角色 SVG
templates/data/       空白的数据目录（问卷、画像、策展记录、参考音说明……）
examples/demo/        虚构孩子「小满」的数据目录，issues/003/ 是一期完整的流水线文件
```

## 自定义

- **刊名**：在问卷里写，默认"昵称 + 早知道"
- **角色**：`assets/characters.js` 里的 SVG，支持表情和道具（墨镜、眼罩、派对帽、围巾、放大镜……）
- **栏目和规则**：都在 `SKILL.md` 里，用中文写的，直接改

## 致谢

- 灵感来自 [kidstack](https://github.com/omaha-eskimo/kidstack)：家长问卷 + 每周策展的思路
- 示例照片来自 Wikimedia Commons，作者和协议见各页署名

## License

MIT
