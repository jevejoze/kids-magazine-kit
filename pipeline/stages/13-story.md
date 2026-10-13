# 13 小剧场

**目标**：编辑部推理连载的一集。真相要能从文中线索推出来。

**读**：`issue/00-brief.json`（`story`）、`data/story-bible.md`

**写**：`issue/13-story.json`

```json
{
  "_meta": {"stage": "13-story", "by": "", "at": ""},
  "ep": 5, "lang": "zh", "night": false,
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
- `lang` 按任务书：单数集中文、双数集英文；中文 ≤ 300 字，英文 ≤ 110 个单词
- 先揭晓 `story.resolve`，再开一个新案子
- 推理结构：至少 1 条关键线索 + 1 条干扰线索，要孩子动脑才能串起来
- 可以用 `<em>…</em>` 标出关键物证
- 浣熊可以调皮，但不做真正的坏事，冲突最后要和好
- `scene` 放 4 个角色各 150，表情贴合剧情；`night` 决定窗外是白天还是夜空

**自检**：字数 / 词数；只看正文能不能推出 `secret` 里的真相
