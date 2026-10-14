# 流水线：一期杂志怎么分步做

一期杂志拆成 17 步，每步只读上游文件、写自己的输出。任何能读写数据目录的 agent 都能接手其中一步：家长说"做第 10 步"，agent 读对应的说明，写出文件就结束。

## 目录

**数据目录**（下文写作 `data/`）放孩子的全部资料，推荐放在 Google Drive 这类各个 agent 都能访问的地方：

```
data/
  MY_CHILD.md  profile.md  curation-log.md  letters.md  child-questions.md
  story-bible.md  vocab.json  feedback.jsonl
  voices/azure.json         讲读版每个角色用哪个 Azure 声音（可选，没写的用默认）
  sfx/                       讲读版音效（可选）
  issues/
    004/                     本期工作区，下文写作 issue/
      00-brief.json
      10-cover.json  11-comic.json  11-diagram.svg  12-words.json  13-story.json
      14-puzzle.json  15-english.json  16-mailbox.json  17-news.json
      20-assets/             图片和 assets.json
      30-issue.json          合并后的整期
      31-review.md
      40-cards/              card-1..7.png 和 PDF
      50-narration.json
      60-audio/
      70-final/              最终 PDF 和讲读视频
```

## 步骤

| 步 | 做什么 | 依赖 | 类型 |
|---|---|---|---|
| 00 | 本期任务书 | — | agent |
| 10 | 封面选题 | 00 | agent |
| 11 | 今日一问（漫画 + 图解） | 10 | agent |
| 12 | 单词屋 | 00 | agent |
| 13 | 小剧场 | 00 | agent |
| 14 | 谜题 | 00 | agent |
| 15 | 英文三关 | 12 | agent |
| 16 | 信箱 | 00 | agent |
| 17 | 环球小报 | 00 | agent |
| 20 | 下载图片 | 10、17 | agent |
| 30 | 合并整期 | 11–17、20 | 脚本 |
| 31 | 审稿 | 30 | agent |
| 40 | 渲染图片和 PDF | 31 | 脚本 |
| 50 | 讲读稿 | 31 | agent |
| 60 | 语音 | 50 | 脚本 |
| 70 | 讲读视频 | 40、60 | 脚本 |
| 90 | 更新档案 | 40 | agent |

00 完成后，10、12、13、14、16、17 可以同时开工。完整定义见 `stages.json`。

## 两种用法

- **指定一步**：家长说"做第 10 步"，agent 只做这一步（见下文"接手一步的做法"）
- **走完全程**：家长只说"出下一期"，当前 agent 从 00 一直做到 90，已经存在的输出视为完成、从缺的那步接着做；做法见 SKILL.md「没有指定步骤时：一个 agent 走完全程」

## 接手一步的做法

1. 读 `pipeline/stages/<步骤>.md`（公开地址：`https://raw.githubusercontent.com/jevejoze/kids-magazine-kit/main/pipeline/stages/<步骤>.md`）
2. 确认依赖步骤的输出文件都在 `issue/` 里；缺了就停下，告诉家长先做哪一步
3. 读说明里列出的输入，写出说明里规定的输出文件，字段名照抄
4. 每个输出 JSON 顶层写 `"_meta": {"stage": "12-words", "by": "<agent 名称>", "at": "<ISO 时间>"}`
5. 按说明里的"自检"逐条检查，再交付
6. 只写自己这一步的输出；发现上游有错，写进自己输出的 `_meta.issues`，交给家长决定

重做某一步：直接覆盖它的输出，再把依赖它的下游步骤重做一遍。

## 脚本步骤

30、40、60、70 需要运行脚本，在任意有 Node 22+、Chrome、Python 3、ffmpeg 的环境里跑（Claude Code 云端会话、自己的电脑都可以）：

```bash
node scripts/pipeline.mjs status   <issue>   # 看每步做了没有、下一步能做什么
node scripts/pipeline.mjs check    <issue>   # 检查已完成步骤的字段和字数
node scripts/pipeline.mjs assemble <issue>   # 第 30 步
node scripts/render.mjs <issue>/30-issue.json <issue>/40-cards --flat   # 第 40 步
node scripts/tts_azure.mjs <issue>           # 第 60 步（Azure 语音）
python3 scripts/make_video.py <issue>        # 第 70 步
```

第 60 步默认用 Azure 语音（`scripts/tts_azure.mjs`），需要环境变量 `AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`；换别的语音服务也行，按 `stages/60-audio.md` 的约定把音频放好即可。
