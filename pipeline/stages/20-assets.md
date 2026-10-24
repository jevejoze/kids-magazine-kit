# 20 下载图片

**读**：`issue/10-cover.json`（`photo.url`）、`issue/17-news.json`（每条的 `photo_url`）、`issue/18-serial.json`（`photo_url`，折纸是 `diagram_url`）

**写**：`issue/20-assets/` 下的图片文件和 `issue/20-assets/assets.json`

```json
{
  "_meta": {"stage": "20-assets", "by": "", "at": ""},
  "cover": "cover.jpg",
  "news": ["news-1.jpg", "news-2.jpg", "news-3.jpg"],
  "serial": "serial.jpg"
}
```

折纸那期没有 `serial`，换成 `"serial_diagram": "serial-diagram.png"`。

**规则**
- 封面图长边 ≥ 1200 像素；新闻图、连载插画长边 ≥ 800 像素；都存成 JPG，单张 ≤ 2 MB（太大就缩小）
- 折纸图式存 PNG，长边 ≥ 1600 像素（线条细，放大了也要看得清）；四周的大片留白裁掉，图式才能在页面上放大：`ffmpeg -i in.png -vf "alphaextract,cropdetect=limit=0:round=2:skip=0" -f null -` 得到 `crop=…`，再 `ffmpeg -i in.png -vf "crop=…,pad=iw+40:ih+40:20:20:color=white@0" serial-diagram.png`（白底不透明的图把 `alphaextract` 换成 `negate`）。裁完看一眼，步骤号别裁掉
- Wikimedia 图片下载要带 User-Agent，被限流就等几秒重试；缩略图宽度用 1280、1920 这类常用尺寸（`upload.wikimedia.org/.../thumb/.../1920px-<文件名>.png`；别的宽度可能返回网页）
- 下载失败或尺寸不够时，换一张同样符合协议的图，并在 `_meta.issues` 里写明换成了什么，交给家长确认

**自检**：每个文件都能打开；`assets.json` 里的文件名都存在；图片和 `assets.json` 都已传到网盘 `issues/NNN/20-assets/`（只传 JSON 不传图片，下游的 agent 就渲染不了）
