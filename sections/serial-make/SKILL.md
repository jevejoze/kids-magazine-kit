# 经典连载 · 动手做（serial-make）

周五（艺术日）连载停一天，信箱前面这一页换成「动手做」：一件折纸（`craft: "origami"`，一张完整图式教）或一个 3D 打印模型（`craft: "3d"`，模型照片 + 4–8 步做法）。页位是 `serial`，本期 `kind` 是 `make` 时由这个包出；周五出哪一种由 `magazine.yaml` 的 `schedule.friday.serial` 轮换表决定，brief 这一步写进任务书 `sections.serial.params.kind`。

## 开工

1. 领任务单：`node scripts/pipeline.mjs ticket <issue> serial`（或 `serial-make`），照单上的规则、参数、角色槽位写；最后一行的指纹写进 `_meta.ticket`
2. 读任务单「要读、要更新的状态」里的文件：
   - `state/serial-make/config.md`：家长写的偏好、打印机型号、手边的纸
   - `state/serial-make/log.jsonl`：做过的，一期一行，别重复
   - 数据目录还没有 `state/serial-make/` 时，片单在旧档案 `serial-bible.md`「周五片单」，打印机型号看 `profile.md`
3. 写 `issue/serial.json`，字段见同目录 `schema.json`

```json
{
  "_meta": {"stage": "serial", "by": "", "at": "", "ticket": "<任务单指纹>"},
  "kind": "make", "craft": "origami",
  "title_zh": "会跳的纸青蛙", "title_en": "Jumping Paper Frog",
  "by": "折纸 · 难度 ⭐⭐ · 约 15 分钟 · 一张名片大小的卡纸",
  "photo_url": "https://commons.wikimedia.org/wiki/File:PaperFrogs.jpg", "photo_credit": "Greeshma856 · CC0", "photo_pos": "center",
  "diagram_url": "https://commons.wikimedia.org/wiki/File:Origami_frog.svg", "diagram_credit": "Ftiercel · Wikimedia Commons · Public domain", "diagram_steps": 9,
  "paragraphs": ["按住屁股一滑就蹦起来，秘密是 Z 字折攒下的弹力。"],
  "tasks": ["长方形对折，折出折痕", "翻面，折出 X 和横线", "……"],
  "crew": {"who": "raccoon:smirk:130", "say": "比谁的青蛙跳得远！"},
  "where": "给家长：跟做视频搜「jumping frog origami」；名片或卡纸最好跳",
  "tbc": "下周五：音乐盒",
  "summary": "一句话：做了什么，归档写进 log.jsonl"
}
```

## 规则

- 一件作品，孩子自己 30 分钟内做得完（3D 打印的等待时间另算）；做好能玩、能摆或能用（会跳的青蛙、能动的关节龙），优先挑和孩子兴趣挂钩的（动物、海怪）
- `crew` 一位编辑部成员说一句（≤ 20 字）

**折纸**：孩子看文字学不会折纸，页面靠一张完整图式教：从一张纸到成品，每一步都画出来、标好步骤号，用标准折纸符号（谷折虚线、山折点划线、箭头、翻面符号）

- 图式来源：先在 Wikimedia Commons 找自由授权的（`Category:Origami diagrams`、搜 `<作品> origami diagram`）；没有就用折纸网站或书上的图式，和新闻原图一样只放在私有数据目录（`image_policy: private-ok`），`diagram_credit` 写作者和来源。`diagram_url` 写图式页面
- 整套 ≤ 12 步、能排在一张图里；assets 这一步会把图式一步切一格、排成网格铺满页面，所以优先挑每一步分得开的图式；只有零散几步、缺步、跳步的图式不用，换一件作品。agent 不自己画图式，也不用文字步骤代替
- `diagram_steps` 写图式的步数；`tasks` 每一步配一句 ≤ 14 字的提示，条数和步数一样，按图式的编号对应（"翻面""对折出折痕"这种图上不好看出的地方写清楚）
- 完成图：`photo_url` 放一张真人折出来的成品照片（排在标题右侧，横图），和图式是同一款；同样先找 Commons（搜 `<作品> origami`），没有就用别处的照片，只放私有数据目录，`photo_credit` 写作者和来源
- `paragraphs` 一句 ≤ 30 字：好玩在哪，带一个背后的小知识（青蛙为什么能跳：纸的弹力）。页面空间留给图式
- `where` 给家长一个跟做视频的搜索词和纸张建议

**3D 打印**

- `paragraphs` ≤ 120 字，这是什么、好玩在哪、一个小知识；`tasks` 写 4–8 步，每步 ≤ 24 字，一步只做一个动作
- 只选 Printables、Thingiverse 上自由授权（CC）、允许个人打印的原创模型，不选真实 IP 角色；挑免支撑、单色 PLA、两小时内打完的
- `photo_url` 用模型页的照片，`photo_credit` 写作者和协议；`by` 写打印时长；`where` 写模型链接和打印设置（材料、层高、要不要支撑），用模型页推荐的参数

## 图片（assets 这一步）

图片都放 `assets/serial-make/`，`assets.json` 里的文件名带上这个子目录：

- 完成图 / 模型照片：`node scripts/assets.mjs fetch <url> <issue>/assets/serial-make/serial.jpg --min 800 --max 1600`，裁到成品占满画面，水印、日期裁掉；`assets.json` 的 `serial` 写 `serial-make/serial.jpg`
- 折纸图式先下载成 PNG（长边 ≥ 1600 像素，线条细，放大了也要看得清；Wikimedia 缩略图宽度用 1920 这类常用尺寸）。然后用拆图脚本：

```bash
# 先只裁整张：四周大片留白裁掉、留 20px 边，出 assets/serial-make/diagram.png（白底不透明图加 --white）
node sections/serial-make/split.mjs <issue> 图式.png
# 在 diagram.png 上量出每一步的格子 x:y:w:h，按步骤顺序一格一个，切出 step-1.png … step-N.png（自动裁掉格子里的留白、留 8px 边）
node sections/serial-make/split.mjs <issue> 图式.png 0:0:600:520 600:0:600:520 … [--white] [--erase 3=x:y:w:h]
```

- 脚本最后一行打印要写进 `assets.json` 的 `serial_steps`（张数等于 `diagram_steps`，页面排成网格，每格下面配那一步的提示）；图式切不开时（几步挤在一起、编号对不上格子）只裁整张，写 `"serial_diagram": "serial-make/diagram.png"`
- 格子里混进邻格纸角时用 `--erase N=x:y:w:h` 把第 N 步那一块 alpha 置 0（坐标相对那一格）。翻面符号、箭头算在它指向的那一步里；原图上的步骤号可以留着，页面另外标号
- 裁完、切完逐张看：步骤号别裁掉，每张只有这一步

## 状态

本步只写 `serial.json`。archive 这一步归档时：有 `state/serial-make/` 就把 `summary` 追加进 `log.jsonl`；旧数据目录照旧写 `bible_update`（追加到 `serial-bible.md`「周五片单」的一行）。

## 自检

`node scripts/pipeline.mjs check <issue>` 没有 `[serial]`、`[assets]` 报错；字数；折纸图式从第 1 步到成品连续不缺步，渲染后每一步的折线、箭头和步骤号看得清。
