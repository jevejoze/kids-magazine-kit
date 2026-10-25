# 70 讲读视频

**目标**：把第 40 步渲染的页面卡片（`40-cards/card-N.png`）和第 60 步合成的音频（`60-audio/c{card}_{序号}.wav`）合成为 10–12 分钟的讲读视频，并把本期 PDF 一并整理到 `70-final/`。

**运行**

```bash
node scripts/make_video.mjs <issue>
# 或兼容 Python 版：
python3 scripts/make_video.py <issue>
```

如果没有语音合成密钥、跳过了第 60 步，则运行以下命令生成家长讲读稿：

```bash
node scripts/pipeline.mjs script <issue>
```

**读**：`issue/50-narration.json`、`issue/40-cards/`（`card-1..N.png`、`<刊名>-第NNN期.pdf`、`build.json`）、`issue/60-audio/`（`c{card}_{序号}.wav`、`manifest.json`、`build.json`）、`data/sfx/`（可选：`page`、`bgm` 及台词引用的音效）

**写**：`issue/70-final/讲读版.mp4`、`issue/70-final/<刊名>-第NNN期.pdf`、`issue/70-final/build.json`（无语音时写 `issue/70-final/家长讲读稿.md`）

**合成规则**
- 每句音频自动裁掉首尾多余静音（> -42 dB），并用 `loudnorm`（`-16 LUFS`）统一响度，不同角色切换时音量平稳；`rate: "slow"` 的句子自动放慢至 `0.82` 倍速
- 句间停顿：未显式指定 `pause` 时，同一角色连说停 `0.22s`，换角色接话停 `0.32s`，问句后停 `0.60s`；显式指定 `pause` 时按 `pause` 秒数留白，并在画面底部叠加 `hold` 提示条
- 翻页过渡：一页念完停 `0.25s` → `0.60s` 画面淡入淡出切换（若 `data/sfx/page.*` 存在则同步播放翻页声）→ 新页稳定后再停 `0.30s` 开口
- 背景音乐：若 `data/sfx/bgm.*` 存在，自动以 `-26 dB` 低音量循环铺底，并在首尾淡入淡出
- 原子发布：先在临时目录完成编码并校验 `inputFingerprint(issue, "70-video")`，成功后再替换 `issue/70-final/` 并写入 `build.json`

**自检**：`70-final/讲读版.mp4` 和 `<刊名>-第NNN期.pdf` 均非空；抽查开头、翻页处和结尾，音画同步、无破音或黑屏；将成品复制到 `data/成品/NNN/` 并上传网盘
