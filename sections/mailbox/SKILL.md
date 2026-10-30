# 信箱（mailbox）

杂志的最后一页，用来收孩子的反馈。页面上固定有 5 个问题，由模板生成：👍 最喜欢哪一页、👎 哪一页不太喜欢、今天难不难、💡 今天想到了什么有趣的问题、👀 今天看到了什么有意思的事。这一步只写页面上方的几句话。页脚"说给谁听"来自 `magazine.yaml` 的 `send_note`（经 `brief.json` 带下来），不用在这一步重写。

## 开工

1. 领任务单：`node scripts/pipeline.mjs ticket <issue> mailbox`，照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`
2. 读 `issue/brief.json`（`last_feedback`）、`data/letters.md`、周六读上一期的 `issue/think.json`
3. 写 `issue/mailbox.json`，字段见同目录 `schema.json`

```json
{
  "_meta": {"stage": "mailbox", "by": "", "at": "", "ticket": "<任务单指纹>"},
  "hello": "小满早上好！你问为什么没有木乃伊猫——其实有，而且很多！",
  "ask_zh": "如果你是蜜蜂，会把家盖成什么形状？"
}
```

## 规则

- 不写 `answers`，不公布上期封面或谜题答案；本期谜题答案已在挑战页底部倒印。
- `hello` ≤ 60 字：一句问候。收到了上期打卡，就接住她的一句话（原话、她想到的问题或她看到的事），没收到就由一个角色说一句和本期主题有关的小事；不再问一遍封面问题（今日一问已经讲了答案）
- `ask_zh`（可选）≤ 30 字，一个和本期内容有关、要说理由的问题
- 周六：接住周五的周末思辨，`hello` 或 `ask_zh` 问一句聊得怎么样（如"昨天的话题，家里谁说服了谁？"）；周五的信箱不重复思辨话题
- 不写长信，不放集章、奖励；连载的"猜一猜"留给下一回连载自己回应
- 不编造孩子说过的话
- 不写 `send_note`：页脚"说给谁听"由 `magazine.yaml` 统一配置，这一步不用管

## 自检

`node scripts/pipeline.mjs check <issue>` 没有 `[mailbox]` 报错；字数；没有上期答案；`hello` 里引用的话在 `letters.md` 或 `feedback.jsonl` 里找得到
