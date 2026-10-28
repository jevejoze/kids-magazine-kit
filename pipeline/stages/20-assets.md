# 20 下载图片

**读**：`issue/08-think.json`（周五才有，`photo_url`，可能为空）、`issue/09-creature.json`（周一才有，`legend_url` 和 `photo_url`）、`issue/10-cover.json`（`photo.url`）、`issue/17-news.json`（每条的 `photo_url`）、`issue/18-serial.json`（`photo_url`，折纸另有 `diagram_url`）、`issue/19-check.json`（`photo_url`，可能为空）

**写**：`issue/20-assets/` 下的图片文件和 `issue/20-assets/assets.json`

```json
{
  "_meta": {"stage": "20-assets", "by": "", "at": ""},
  "cover": "cover.jpg",
  "creature": "creature.jpg",
  "creature_legend": "creature-legend.jpg",
  "news": ["news-1.jpg", "news-2.jpg", "news-3.jpg"],
  "serial": "serial.jpg",
  "check": "check.jpg",
  "think": "think.jpg"
}
```

`creature`、`creature_legend` 只在周一有；`check`、`think` 只在 `19-check.json`、`08-think.json` 有 `photo_url` 时有，没有就不写这些字段。

折纸那期的 `serial` 是成品的完成图（横图，裁到成品占满画面，水印、日期裁掉），另加 `"serial_steps": ["step-1.png", …]`（图式一步切一张，张数等于 `diagram_steps`，页面排成网格铺满，每格下面配那一步的提示）；图式切不开时（几步挤在一起、编号对不上格子）才用整张 `"serial_diagram": "serial-diagram.png"`。

**工具脚本**（推荐直接调用 `scripts/assets.mjs`，自动带上 Wikimedia User-Agent、429 重试、尺寸校验与 `cropdetect` 裁边）：
```bash
node scripts/assets.mjs fetch <url> <issue>/20-assets/cover.jpg --min 1200 --max 2000
node scripts/assets.mjs fetch <url> <issue>/20-assets/news-1.jpg --min 800 --max 1600
node scripts/assets.mjs trim  in.png <issue>/20-assets/serial-diagram.png --pad 20
node scripts/assets.mjs slice <issue>/20-assets/serial-diagram.png <issue>/20-assets/step-1.png <x:y:w:h> --pad 8
```

**规则**
- 封面图长边 ≥ 1200 像素；新闻图、怪物卡、连载插画、真的假的和周末思辨配图长边 ≥ 800 像素；都存成 JPG，单张 ≤ 2 MB（太大就缩小）
- 折纸图式存 PNG，长边 ≥ 1600 像素（线条细，放大了也要看得清）；四周的大片留白用 `node scripts/assets.mjs trim in.png serial-diagram.png --pad 20`（白底不透明图加 `--white`）裁掉，图式才能在页面上放大（底层用 `ffmpeg` 的 `alphaextract/negate,cropdetect` 裁边并留 20px 边）。裁完看一眼，步骤号别裁掉
- 切步骤：在裁好的整张图式上量出每一步的格子（`x:y:w:h`），用 `node scripts/assets.mjs slice serial-diagram.png step-N.png <x:y:w:h> --pad 8`（格子里混进邻格纸角时可加 `--erase <x:y:w:h>` 把那一块 alpha 置 0）切出来并自动裁掉格子里的留白、留 8px 边。翻面符号、箭头算在它指向的那一步里；原图上的步骤号可以留着，页面另外标号。切完逐张看，每张只有这一步
- Wikimedia 图片下载要带 User-Agent，被限流就等几秒重试；缩略图宽度用 1280、1920 这类常用尺寸（`upload.wikimedia.org/.../thumb/.../1920px-<文件名>.png`；别的宽度可能返回网页）
- 下载失败或尺寸不够时，换一张同样符合协议的图，并在 `_meta.issues` 里写明换成了什么，交给家长确认

**自检**：每个文件都能打开；`assets.json` 里的文件名都存在
