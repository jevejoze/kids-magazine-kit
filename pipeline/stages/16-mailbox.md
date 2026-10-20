# 16 信箱

**读**：`issue/00-brief.json`（`last_answers`、`letters_summary`、`send_note`、`stamps_done`）、`data/letters.md`（孩子最近的回复）、上一期 `issue/18-serial.json`（`guess`）

**写**：`issue/16-mailbox.json`

```json
{
  "_meta": {"stage": "16-mailbox", "by": "", "at": ""},
  "letter": "亲爱的小满：<br>……<br><span style=\"float:right\">—— 编辑部全员 🐶🐭🦉🦝</span>",
  "ask_zh": "🧩 开放题：……？说出理由！",
  "ask_en": "……?",
  "stamps_done": 5,
  "reward": "集满 7 个章，换一张编辑部限定壁纸 🎁",
  "send_note": "拍照发给妈妈"
}
```

**规则**
- `letter`：收到回复就先夸一个具体的点（引用孩子原话），再公布上期答案；没收到回复就由一个角色讲一件和本期主题有关的小事，再公布上期答案。≤ 110 字
- 孩子回了上期连载的"猜一猜"，在信里接一句（猜中了就夸，没猜中就说"今天翻到最后一页看看"），不剧透本期连载
- 不编造孩子说过的话
- `ask_zh` 是需要说理由的开放问题，和本期主题有关，≤ 40 字

**自检**：公布的答案和 `last_answers` 一致
