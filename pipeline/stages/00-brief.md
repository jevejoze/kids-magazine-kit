# 00 本期任务书

**目标**：定下这一期做什么，给后面各步一个统一的方向。后面所有步骤都先读这个文件。

**读**：`data/MY_CHILD.md`、`data/profile.md`、`data/curation-log.md`（最近一次策展结论和随手记）、`data/child-questions.md`、`data/story-bible.md`、`data/serial-bible.md`、`data/letters.md`、上一期的 `issue/30-issue.json`（取期号、上期答案、`_answers`）

**写**：`issue/00-brief.json`（`issue/` = `data/issues/NNN/`，NNN 是三位期号，文件夹不存在就新建）

```json
{
  "_meta": {"stage": "00-brief", "by": "", "at": ""},
  "issue": 5,
  "date": "2026.10.16 周五",
  "weekday_theme": "艺术手工",
  "weather": "🎨 艺术日",
  "masthead": {"zh": "小满早知道", "en": "XIAOMAN KNOWS!", "by": "🐶🐭🦉🦝 团子编辑部 出品"},
  "send_note": "拍照发给妈妈",
  "english_level": "L2",
  "stamps_done": 5,
  "topic_hint": "向日葵的螺旋",
  "child_question": null,
  "focus": ["英文写作从一句完整的话开始"],
  "avoid": ["已经讲过的极昼、六边形"],
  "story": {"ep": 5, "lang": "zh", "resolve": "波波鼠的伦敦手表（时差）", "plan": "揭晓真相并留下新悬念"},
  "serial": {"kind": "book", "ep": 3, "plan": "第 1 章后半：鼹鼠抢桨翻船，河鼠救起他"},
  "last_answers": {"cover": "A", "puzzle": "18 / 37 / 5 圈", "english": ["more"]},
  "letters_summary": "上期没有收到回复"
}
```

**规则**
- `weekday_theme` 按周节奏：周一自然科学、周二历史人物、周三世界各地、周四数学趣题、周五艺术手工、周六亲子小实验、周日周刊回顾
- `topic_hint` 只给方向，具体选题由第 10 步决定；孩子提过的问题优先，放进 `child_question`（含原话和日期）
- `focus` 和 `avoid` 来自问卷第七部分和最近一次策展结论
- `story`：单数集中文、双数集英文；`resolve` 写上一集留下要揭晓的伏笔
- `serial`：周五按 `serial-bible.md`「周五片单」排下一个（`kind` 写 `music` 或 `film`，`plan` 写作品名）；其他日子 `kind` 写 `book`，`ep` = 上一回 + 1，`plan` 抄分集计划里这一回的内容
- `last_answers` 从上一期 `30-issue.json` 的 `_answers` 抄，供信箱公布

**自检**：期号 = 上期 + 1；日期和星期对得上；`story.lang` 和集数单双一致；`serial.ep` 接得上 `serial-bible.md`「进度」的最后一回
