# 15 英文三关（暂停，可选）

> 目前默认不做：挑战页只放中文谜题，浣熊台词由第 14 步写。家长在 `profile.md` 里写明要英文三关时才做这一步，这时 `taunt_zh` / `taunt_en` 可省略。

**读**：`issue/00-brief.json`、`issue/12-words.json`

**写**：`issue/15-english.json`

```json
{
  "_meta": {"stage": "15-english", "by": "", "at": ""},
  "taunt_zh": "哼，数格子？我数得比蜜蜂还快！",
  "taunt_en": "Can you count faster than a bee?",
  "prop": "",
  "english": [
    {"stars": 1, "cn": "选一个词填进去", "en": "A hexagon has ___ sides than a square. (more / fewer)"},
    {"stars": 2, "cn": "读一读，回答问题", "en": "3–4 句短文 + 一个问题"},
    {"stars": 3, "cn": "用英文说 2 句，要用到 because", "en": "一个开放问题"}
  ],
  "answers": ["more", "Because ……", "开放题"]
}
```

**规则**
- 第 1 关 ⭐：用本期单词改错或填空，括号里给两个选项
- 第 2 关 ⭐⭐：3–4 句短文 + 1 个问题，答案能在短文里找到
- 第 3 关 ⭐⭐⭐：让孩子用英文说 2 句自己的想法，口头回答，不留手写格子
- 句子难度按 `english_level`；英文每关 ≤ 45 个单词
- 浣熊台词中英各一句，调皮、嘴硬心软；`prop` 可选（`sweat` `magnifier` 等）

- 各关参考答案在挑战页底部一起倒印，不在下一期信箱公布。

**自检**：第 1、2 关答案唯一
