# 小剧场（story）

编辑部推理连载的一集：一页中文小故事，真相要能从文中线索推出来，结尾留悬念。

## 开工

1. 领任务单：`node scripts/pipeline.mjs ticket <issue> story`，照单上的规则、参数、角色槽位写；最后一行的指纹写进 `_meta.ticket`
2. 读任务书的 `story` 块（`ep`、`resolve`、`plan`）和任务单「要读、要更新的状态」里的文件：
   - `state/story/config.md`：家长写的设定（场景、人物关系、口吻）
   - `state/story/log.jsonl`：前几集，一集一行
   - `state/story/open-threads.md`：还没回收的伏笔
3. 写 `issue/story.json`，字段见同目录 `schema.json`

```json
{
  "_meta": {"stage": "story", "by": "", "at": "", "ticket": "<任务单指纹>"},
  "ep": 5, "night": false,
  "title_zh": "……", "title_en": "……",
  "paragraphs": ["……", "……"],
  "scene": ["<asker>:sleepy:150", "<expert>:think:150:magnifier", "<english>:surprise:150", "<trickster>:smirk:150"],
  "clue": "侦探笔记：……？",
  "tbc": "……明天揭晓！To be continued…",
  "secret": "本集真相、关键线索、干扰线索（只给家长看）",
  "summary": "一句话本集摘要，归档写进 log.jsonl",
  "threads_after": ["本集之后还没回收的伏笔，每条一句"]
}
```

`scene` 里写具体角色代号（任务单「角色槽位」查槽位由谁担），上面的 `<槽位>` 只是占位。

## 规则

- 每集都用中文写，≤ 300 字。english 槽位的角色可以自然地冒一两句简单英文、别的角色接一句中文，不刻意多放也不刻意删
- 先揭晓 `story.resolve`，再开一个新案子
- 推理结构：至少 1 条关键线索 + 1 条干扰线索，要孩子动脑才能串起来
- 可以用 `<em>…</em>` 标出关键物证
- trickster 可以调皮，但不做真正的坏事，冲突最后要和好
- `clue`（侦探笔记）针对本回结尾留下的未解悬念或最新线索发问，引导孩子推理下一步；不倒回去问本回前面已经解决并揭晓的问题
- `scene` 放 4 个角色各 150，表情贴合剧情；`night` 决定窗外是白天还是夜空
- 页面版式：段落 ≤ 4 段时，提到 english、asker、expert、trickster 角色名字的段落分别排成对应的角色行

## 状态

- `threads_after` 是本集之后的完整伏笔清单：旧伏笔这集回收了就删掉，新埋的加上；都回收了写 `[]`
- 本步只写 `story.json`。archive 这一步归档时才把本集追加进 `log.jsonl`、用 `threads_after` 重写 `open-threads.md`，所以一期定稿后状态才变
- 数据目录还没有 `state/story/`（旧档案 `story-bible.md`）时照旧写 `bible_update`，归档追加进 `story-bible.md`

## 自检

`node scripts/pipeline.mjs check <issue>` 没有 `[story]` 报错；字数；只看正文能不能推出 `secret` 里的真相。
