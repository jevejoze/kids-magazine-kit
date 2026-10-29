# 13 小剧场

开工前领任务单：`node scripts/pipeline.mjs ticket <issue> story`，照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`。

**目标**：编辑部推理连载的一集。真相要能从文中线索推出来。

**读**：`issue/00-brief.json`（`story`）、`data/story-bible.md`

**写**：`issue/13-story.json`

```json
{
  "_meta": {"stage": "13-story", "by": "", "at": "", "ticket": "<任务单指纹>"},
  "ep": 5, "night": false,
  "title_zh": "……", "title_en": "……",
  "paragraphs": ["……", "……"],
  "scene": ["dog:sleepy:150", "owl:think:150:magnifier", "mouse:surprise:150", "raccoon:smirk:150"],
  "clue": "侦探笔记：……？",
  "tbc": "……明天揭晓！To be continued…",
  "secret": "本集真相、关键线索、干扰线索（只给家长看）",
  "bible_update": "追加到 story-bible.md 的本集摘要和新伏笔"
}
```

**规则**
- 每集都用中文写，≤ 300 字。波波鼠可以自然地冒一两句简单英文、别的角色接一句中文，不刻意多放也不刻意删
- 先揭晓 `story.resolve`，再开一个新案子
- 推理结构：至少 1 条关键线索 + 1 条干扰线索，要孩子动脑才能串起来
- 可以用 `<em>…</em>` 标出关键物证
- 浣熊可以调皮，但不做真正的坏事，冲突最后要和好
- `clue`（侦探笔记）针对本回结尾留下的未解悬念或最新线索发问，引导孩子推理下一步；不倒回去问本回前面已经解决并揭晓的问题
- `scene` 放 4 个角色各 150，表情贴合剧情；`night` 决定窗外是白天还是夜空

**自检**：字数；只看正文能不能推出 `secret` 里的真相
