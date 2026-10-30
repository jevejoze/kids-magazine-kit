# 今日一问栏目样张

`honey.json`、`cat.json` 是独立的 `comic` 对象，搭配同名 SVG；用于检查不同题材的版面与解释方式，不是已经出版的整期。极昼样张采用 `../demo/issues/003/comic.json`。

- **极昼：机制解释**。前两格提出问题、引入倾斜，中间图用红点的一圈路线解释，后两格回答冬季追问并给出手电筒实验。见 NASA Earth Facts、NOAA 北极昼夜资料和 LPI SkyTellers；链接保存在示例源文件。
- **蜂巢：等面积比较**。先看圆格空隙，再比较等面积正方形和正六边形。单位面积下，正方形周长为 4，正六边形周长为 `6 × sqrt(2 / (3 × sqrt(3))) ≈ 3.72242`，少约 6.94%，图中取整为 7%。这是平面周长比较，不把它当作真实蜂蜡用量的实测节省率。圆格只用于展示空隙，不参与该周长计算。数学依据：[Thomas Hales, The Honeycomb Conjecture](https://arxiv.org/abs/math/9906042)。
- **猫木乃伊：证据链**。区分外观、古代用途与检测证据，不把“包裹像猫”直接等同于“里面有完整的猫”。依据为[史密森尼馆藏记录](https://www.si.edu/object/mummy-cat-wrapped-linen%3Anmnhanthropology_8125402)和[埃默里大学卡洛斯博物馆](https://collections.carlos.emory.edu/objects/21069/cat-mummy)。图标仅为流程示意，不是实际扫描影像或建筑复原图。

本地复现（将下列 `honey` 换成 `cat` 可切换样张）：

```bash
node --input-type=module <<'JS'
import fs from 'node:fs';
const kind = 'honey', root = `output/comic-${kind}`;
fs.mkdirSync(root, { recursive: true });
const data = JSON.parse(fs.readFileSync('examples/demo/issues/003/issue.json'));
data.comic = JSON.parse(fs.readFileSync(`examples/comic-previews/${kind}.json`));
data.comic.diagram = fs.readFileSync(`examples/comic-previews/${kind}.svg`, 'utf8');
fs.cpSync('examples/demo/issues/003/assets', `${root}/assets`, { recursive: true });
fs.writeFileSync(`${root}/issue.json`, JSON.stringify(data, null, 2));
JS
node scripts/render.mjs output/comic-honey/issue.json output/comic-honey/cards --preview --flat
```

内容来源、短对白、每格标题及图后结论均在 JSON 内，调整时可直接对照 PNG 预览。素材库与 SVG 角色共用同一版式。
