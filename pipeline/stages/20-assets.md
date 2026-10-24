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

**规则**
- 封面图长边 ≥ 1200 像素；新闻图、怪物卡、连载插画、真的假的和周末思辨配图长边 ≥ 800 像素；都存成 JPG，单张 ≤ 2 MB（太大就缩小）
- 折纸图式存 PNG，长边 ≥ 1600 像素（线条细，放大了也要看得清）；四周的大片留白裁掉，图式才能在页面上放大：`ffmpeg -i in.png -vf "alphaextract,cropdetect=limit=0:round=2:skip=0" -f null -` 得到 `crop=…`，再 `ffmpeg -i in.png -vf "crop=…,pad=iw+40:ih+40:20:20:color=white@0" serial-diagram.png`（白底不透明的图把 `alphaextract` 换成 `negate`）。裁完看一眼，步骤号别裁掉
- 切步骤：在裁好的整张图式上量出每一步的格子（x、y、宽、高），`ffmpeg -i serial-diagram.png -vf "crop=宽:高:x:y" cell.png` 切出来，再用上面的 `cropdetect` 裁掉格子里的留白、`pad=iw+16:ih+16:8:8:color=white@0` 留一圈边，存成 `step-N.png`。翻面符号、箭头算在它指向的那一步里；格子里混进邻格的纸角时，用 `geq` 把那一块的 alpha 设成 0 再裁（如 `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X,42)*gt(Y,140),0,alpha(X,Y))'`）。原图上的步骤号可以留着，页面另外标号。切完逐张看，每张只有这一步
- Wikimedia 图片下载要带 User-Agent，被限流就等几秒重试；缩略图宽度用 1280、1920 这类常用尺寸（`upload.wikimedia.org/.../thumb/.../1920px-<文件名>.png`；别的宽度可能返回网页）
- 下载失败或尺寸不够时，换一张同样符合协议的图，并在 `_meta.issues` 里写明换成了什么，交给家长确认

**自检**：每个文件都能打开；`assets.json` 里的文件名都存在；图片和 `assets.json` 都已传到网盘 `issues/NNN/20-assets/`（只传 JSON 不传图片，下游的 agent 就渲染不了）
