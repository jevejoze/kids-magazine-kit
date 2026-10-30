# 脑筋急转弯（riddle）

数据仓库自带的自定义栏目，不属于引擎：一句脑筋急转弯 + 一个提示，答案倒印在页底。

## 开工

1. 领任务单：`node scripts/pipeline.mjs ticket <issue> riddle`
2. 写 `issue/riddle.json`

```json
{"riddle": "什么东西越洗越脏？", "hint": "想一想洗完它要倒掉的那个", "answer": "水"}
```

## 规则

- `riddle` ≤ 40 字，`hint` ≤ 20 字，`answer` ≤ 20 字
- 不出现真实 IP，按红线过滤

## 自检

`node scripts/pipeline.mjs check <issue>` 没有 `[riddle]` 报错
