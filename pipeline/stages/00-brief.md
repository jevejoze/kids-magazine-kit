# 00 本期任务书

**目标**：定下这一期做什么，给后面各步一个统一的方向。后面所有步骤都先读这个文件。

**读**：`data/MY_CHILD.md`、`data/profile.md`、`data/curation-log.md`（最近一次策展结论和随手记）、`data/child-questions.md`、`data/story-bible.md`、`data/serial-bible.md`、`data/creature-log.md`、`data/think-log.md`、`data/letters.md`、上一期的 `issue/30-issue.json`（取期号和连载进度）

**写**：`issue/00-brief.json`（`issue/` = `data/issues/NNN/`，NNN 是三位期号，文件夹不存在就新建）

**先跑调度**：`node scripts/pipeline.mjs schedule issue/ YYYY-MM-DD`。它按 `data/magazine.yaml`（没有就用默认配置）、日期和思维课表算好本期出哪些栏目，写进任务书的 `sections`（每栏合并好的 `params`），同时填好 `date`、`weekday_theme`、`creature`、`think`，周五填 `serial.kind`。这几个字段由调度写，agent 不手改；要改栏目、出刊日、轮换或参数，改 `magazine.yaml` 再跑一遍调度。其余字段由 agent 按下面的规则补齐，补完可以再跑一遍调度，已写的字段原样保留

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
  "topic_hint": "向日葵的螺旋",
  "child_question": null,
  "focus": ["英文写作从一句完整的话开始"],
  "avoid": ["已经讲过的极昼、六边形"],
  "story": {"ep": 5, "lang": "zh", "resolve": "波波鼠的伦敦手表（时差）", "plan": "揭晓真相并留下新悬念"},
  "serial": {"kind": "book", "ep": 3, "plan": "第 1 章后半：鼹鼠抢桨翻船，河鼠救起他"},
  "creature": false,
  "think": false,
  "sections": {"cover": {"params": {"narration_lines": 12, "image_policy": "private-ok"}}, "…": {}},
  "last_feedback": "上期打卡：最喜欢环球小报，刚刚好；想到的问题：为什么没有木乃伊猫？"
}
```

**规则**
- `weekday_theme` 由调度按 `magazine.yaml` 的 `schedule.weekday_theme` 填（默认周一自然科学、周二历史人物、周三世界各地、周四数学趣题、周五艺术手工、周六亲子小实验、周日周刊回顾）。周六、周日的挑战页照常是谜题
- `topic_hint` 只给方向，具体选题由第 10 步决定；孩子提过的问题优先，放进 `child_question`（含原话和日期）
- `focus` 和 `avoid` 来自问卷第七部分和最近一次策展结论
- `story`：每集都是中文；`resolve` 写上一集留下要揭晓的伏笔
- `serial`：`kind` 由调度填（周五按 `schedule.friday.serial` 轮换成 `music`、`film` 或 `make`，其他日子是 `book`）。周五按 `serial-bible.md`「周五片单」里这一类的下一个写 `plan`（作品名）；其他日子 `ep` = 上一回 + 1，`plan` 抄分集计划里这一回的内容
- `creature`、`think`：调度按 `schedule.days` 填（默认周一出传说怪物档案、第 09 步；周五出周末思辨、第 08 步），和 `sections` 里有没有这一栏一致
- `last_feedback` 从 `data/feedback.jsonl` 和 `data/letters.md` 取孩子上一期的打卡（最喜欢、不喜欢、难度、她想到的问题、她看到的事），没收到就写"没有收到"。她想到的问题同时记进 `child-questions.md`

**自检**：期号 = 上期 + 1；日期和星期对得上；`serial.ep` 接得上 `serial-bible.md`「进度」的最后一回
