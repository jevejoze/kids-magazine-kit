# 20 下载图片

**读**：`issue/08-think.json`（周五才有，`photo_url`，可能为空）、`issue/09-creature.json`（周一才有，`legend_url` 和 `photo_url`）、`issue/10-cover.json`（`photo.url`）、`issue/17-news.json`（每条的 `photo_url`）、`issue/18-serial.json`（`photo_url`，折纸另有 `diagram_url`）、`issue/19-check.json`（`photo_url`，可能为空）

**写**：`issue/20-assets/` 下的图片文件和 `issue/20-assets/assets.json`

```json
{
  "_meta": {"stage": "20-assets", "by": "", "at": ""},
  "cover": "cover.jpg",
  "creature": "creature/creature.jpg",
  "creature_legend": "creature/creature-legend.jpg",
  "news": ["news/news-1.jpg", "news/news-2.jpg", "news/news-3.jpg"],
  "serial": "serial.jpg",
  "check": "check.jpg",
  "think": "think.jpg"
}
```

`creature`、`creature_legend` 只在周一有；`check`、`think` 只在 `19-check.json`、`08-think.json` 有 `photo_url` 时有，没有就不写这些字段。

栏目包的图片放 `20-assets/<栏目包 id>/`（如 `20-assets/serial-book/serial.jpg`），`assets.json` 里的文件名带上子目录；旧期直接放在 `20-assets/` 下的照旧能用。

折纸那期（`serial-make`）的 `serial` 是成品的完成图，另加 `serial_steps`（图式一步一张）或 `serial_diagram`（整张）；图式怎么裁、怎么切见 `sections/serial-make/SKILL.md`「图片」。

**工具脚本**（推荐直接调用 `scripts/assets.mjs`，栏目包也用这个共享模块，自动带上 Wikimedia User-Agent、429 重试、尺寸校验与 `cropdetect` 裁边）：
```bash
node scripts/assets.mjs fetch <url> <issue>/20-assets/cover.jpg --min 1200 --max 2000
node sections/news/fetch.mjs <issue> [<直链 1> <直链 2> <直链 3>]      # 3 张进 20-assets/news/
node sections/creature/fetch.mjs <issue> [<传说图直链> <照片直链>]       # 周一，进 20-assets/creature/
node scripts/assets.mjs fetch <url> <issue>/20-assets/serial-book/serial.jpg --min 800 --max 1600
node sections/serial-make/split.mjs <issue> 图式.png <x:y:w:h> …    # 折纸图式裁边、一步切一张
```

**规则**
- 封面图长边 ≥ 1200 像素；新闻图、怪物卡、连载插画、真的假的和周末思辨配图长边 ≥ 800 像素；都存成 JPG，单张 ≤ 2 MB（太大就缩小）
- 折纸图式存 PNG，长边 ≥ 1600 像素，裁边和切步骤照 `sections/serial-make/SKILL.md`
- Wikimedia 图片下载要带 User-Agent，被限流就等几秒重试；缩略图宽度用 1280、1920 这类常用尺寸（`upload.wikimedia.org/.../thumb/.../1920px-<文件名>.png`；别的宽度可能返回网页）
- 下载失败或尺寸不够时，换一张同样符合协议的图，并在 `_meta.issues` 里写明换成了什么，交给家长确认

**自检**：每个文件都能打开；`assets.json` 里的文件名都存在
