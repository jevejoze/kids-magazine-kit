# 团子编辑部 · 绘本角色试验版

首版是四位角色各 9 种表情的固定头像素材，共 36 帧。全身动作还没有入库，`reference.png` 是后续制作的形象参考。

- `dog.png`、`mouse.png`、`owl.png`、`raccoon.png`：每位角色独立一张 3×3 透明 PNG 图集。只生成一次，各期重复使用。
- `manifest.json`：版本、图片 SHA-256、尺寸、每个表情的裁切窗口及道具锚点。`attachments` 使用 200×200 角色坐标，按表情分别记录双眼 `[左x, 左y, 右x, 右y]`、头顶 `[x, y]` 和颈部 `[x, y, 宽度]`；眼罩、墨镜沿双眼连线居中，围巾按颈部位置和宽度缩放。
- `reference.png`：家长看过的角色设定板；生产头像从它派生，保留配色和辨识特征。
- `prompts.md`：使用内置 image_gen 的生成与修订记录。

在任务书 `00-brief.json` 中设置 `"character_pack": "storybook-v1"`，合并会把选择写入整期 JSON。不设置则使用原有 SVG。渲染时图集内嵌到 HTML，无需额外联网加载角色图片。

原来的 `dog:surprise:160:eyemask` 等写法保持可用；漫画头像现在读取对应角色的表情和道具。`box`、`dogbox` 用同一批头像组合纸箱；眼罩、墨镜、围巾、派对帽、放大镜和汗珠仍是独立 SVG 图层。

表情固定为 `normal happy wave smirk sleepy angry surprise talk think`。这里的 `wave` 是招呼表情，不承诺全身挥手动作。不得在每期重新生成或覆盖图集。新增形象、调整帧或修正图片时，另建 `storybook-v2`，旧期继续引用旧版本。加载器校验 PNG 的 SHA-256、尺寸和帧范围；制作记录同时跟踪素材库文件。

查看全部素材：

```bash
node scripts/preview-characters.mjs storybook-v1
```

用 `--preview` 渲染草稿可以先看视觉效果；正式期刊更换角色包后仍须按流程重新合并、审稿和渲染。此试验版不把新增道具或新动作自动生成为图片，缺少素材时明确报错。
