# 单词屋（words，暂停，可选）

目前默认不做，页面里没有单词屋。家长在 `magazine.yaml` 的 `sections` 里写上 `words` 时才做这一步；做了，模板会自动把单词屋排在今日一问后面。

## 开工

1. 领任务单：`node scripts/pipeline.mjs ticket <issue> words`，照单上的规则、参数、角色槽位写，最后一行的指纹写进 `_meta.ticket`
2. 读 `issue/brief.json`（主题、`english_level`）、`data/vocab.json`（已学单词，避免重复）
3. 写 `issue/words.json`，字段见同目录 `schema.json`

```json
{
  "_meta": {"stage": "words", "by": "", "at": "", "ticket": "<任务单指纹>"},
  "intro": "Hi, it's Boba Mouse! 🐝 Today we count sides with the bees. Buzz buzz! 嗡嗡！",
  "grammar": "比较级 more / less / better",
  "items": [
    {"word": "hexagon", "cn": "六边形", "icon": "🐝", "example": "A hexagon has more sides than a square.", "new": true},
    {"word": "wax", "cn": "蜂蜡、蜡", "icon": "🕯️", "example": "Bees use less wax when they build hexagons."},
    {"word": "shape", "cn": "形状", "icon": "🔷", "example": "Which shape is better for bees, a circle or a hexagon?"}
  ],
  "task": "用比较级写一句：比一比正方形和三角形，谁的边更多？（more sides）",
  "lines": 2
}
```

## 规则

- 3 个词，至少 1 个 `"new": true`（孩子大概率没学过的）；3 个词都不在 `vocab.json` 里
- 例句 8–12 个词，3 句都用到 `grammar` 写的语法点；例句里要出现单词本身（模板会自动高亮）
- 档位：L1 一般过去时、比较级，句子 ≤ 9 个词；L2 可用 because / when / if 从句；L3 可用现在完成时、情态动词
- `intro` 是波波鼠的开场白，英文为主，可夹一个中文词，≤ 18 个英文单词
- `task` 让孩子自己造句或改写句子（跟读不算），≤ 40 字
- `icon` 用一个 emoji

## 自检

`node scripts/pipeline.mjs check <issue>` 没有 `[words]` 报错；数每句例句的词数；查 `vocab.json` 无重复
