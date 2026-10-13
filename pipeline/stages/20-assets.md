# 20 下载图片

**读**：`issue/10-cover.json`（`photo.url`）、`issue/17-news.json`（每条的 `photo_url`）

**写**：`issue/20-assets/` 下的图片文件和 `issue/20-assets/assets.json`

```json
{
  "_meta": {"stage": "20-assets", "by": "", "at": ""},
  "cover": "cover.jpg",
  "news": ["news-1.jpg", "news-2.jpg", "news-3.jpg"]
}
```

**规则**
- 封面图长边 ≥ 1200 像素；新闻图长边 ≥ 800 像素；都存成 JPG，单张 ≤ 2 MB（太大就缩小）
- Wikimedia 图片下载要带 User-Agent，被限流就等几秒重试；缩略图宽度用 1280、1920 这类常用尺寸
- 下载失败或尺寸不够时，换一张同样符合协议的图，并在 `_meta.issues` 里写明换成了什么，交给家长确认

**自检**：每个文件都能打开；`assets.json` 里的文件名都存在
