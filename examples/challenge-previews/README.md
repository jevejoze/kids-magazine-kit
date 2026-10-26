# 浣熊挑战样张

默认只有一道中文谜题，不启用已暂停的英文三关。三张独立样张均包含 `puzzle`、浣熊台词和倒印答案，不是完整期刊：

- `queue.json`：四人排序。枚举 24 种排列，唯一解是阿米尔、健太、艾莎、卢卡。
- `math.json`：两步计算。先求换船后的 18 / 18 人，再还原换船前的 22 / 14 人；换走 4 人使人数差缩小 8 人。
- `order.json`：五盏灯排序。枚举 120 种排列，唯一解是紫、红、黄、蓝、绿。

模板按“情境 → 编号线索 → 你来判断”显示，底部只倒印最终答案，不留手写区，不等下一期。题目不靠人物国籍等无用信息增加阅读负担。

可用下面的方式生成本地预览（`queue` 可换为 `math` 或 `order`）：

```bash
node --input-type=module <<'JS'
import fs from 'node:fs';
const kind = 'queue', root = `output/challenge-${kind}`;
fs.mkdirSync(root, { recursive: true });
const data = JSON.parse(fs.readFileSync('examples/demo/issues/003/30-issue.json'));
const sample = JSON.parse(fs.readFileSync(`examples/challenge-previews/${kind}.json`));
data.challenge = { taunt_zh: sample.taunt_zh, prop: sample.prop, puzzle: sample.puzzle };
data._answers.puzzle = sample.answer;
delete data._answers.english;
fs.cpSync('examples/demo/issues/003/20-assets', `${root}/20-assets`, { recursive: true });
fs.writeFileSync(`${root}/issue.json`, JSON.stringify(data, null, 2));
JS
node scripts/render.mjs output/challenge-queue/issue.json output/challenge-queue/cards --preview --flat
```

预览 PNG、PDF 和对比页仅保存在忽略的 `output/`，不提交仓库。历史示例 003 保留可选英文三关，仅用于兼容验证；不据此给新期刊启用英文练习。
