# 浣熊挑战样张

默认只有一道中文谜题，不启用已暂停的英文三关。三张独立样张均包含 `puzzle`、浣熊台词和倒印答案，不是完整期刊：

- `queue.json`：四人排序。没有一条线索直接定位，要分艾莎在第 2 位、第 3 位两种情况试；枚举 24 种排列，唯一解是阿米尔、艾莎、健太、卢卡。
- `math.json`：倒推的和倍问题。换船后乙船是甲船的 2 倍，先求换船后的 12 / 24 人，再还原换船前的 16 / 20 人。
- `order.json`：五盏灯排序。红灯、绿灯的间隔把红灯定在第 1 或第 2 位，再结合"不在两端"推出；枚举 120 种排列，唯一解是紫、红、黄、蓝、绿。

三道样题都满足：答案唯一，去掉任意一条线索就不止一个解（`tests/challenge.test.mjs` 会检查）。

模板按“情境 → 编号线索 → 你来判断”显示，底部只倒印最终答案，不留手写区，不等下一期。题目不靠人物国籍等无用信息增加阅读负担。

可用下面的方式生成本地预览（`queue` 可换为 `math` 或 `order`）：

```bash
node --input-type=module <<'JS'
import fs from 'node:fs';
const kind = 'queue', root = `output/challenge-${kind}`;
fs.mkdirSync(root, { recursive: true });
const data = JSON.parse(fs.readFileSync('examples/demo/issues/003/issue.json'));
const sample = JSON.parse(fs.readFileSync(`examples/challenge-previews/${kind}.json`));
data.challenge = { taunt_zh: sample.taunt_zh, prop: sample.prop, puzzle: sample.puzzle };
data._answers.puzzle = sample.answer;
delete data._answers.english;
fs.cpSync('examples/demo/issues/003/assets', `${root}/assets`, { recursive: true });
fs.writeFileSync(`${root}/issue.json`, JSON.stringify(data, null, 2));
JS
node scripts/render.mjs output/challenge-queue/issue.json output/challenge-queue/cards --preview --flat
```

预览 PNG、PDF 和对比页仅保存在忽略的 `output/`，不提交仓库。历史示例 003 保留可选英文三关，仅用于兼容验证；不据此给新期刊启用英文练习。
