# 60 语音

**目标**：把 `50-narration.json` 里每一句合成成音频。用什么语音服务由执行者决定。

**读**：`issue/50-narration.json`、`data/voices/voices.json`（角色和参考音，可选）

**写**：`issue/60-audio/` 下每句一个文件，命名 `c{card}_{序号}.wav`（序号是这句在该页 `lines` 里的位置，从 0 开始，两位数，如 `c3_04.wav`），外加 `issue/60-audio/manifest.json`：

```json
{"_meta": {"stage": "60-audio", "by": "", "at": ""},
 "voices": {"dog/zh": "所用的声音或参考音", "mouse/en": "……"},
 "files": [{"card": 1, "index": 0, "file": "c1_00.wav", "seconds": 3.2}]}
```

**规则**
- 每句按正常语速合成一遍即可；`repeat`、`rate`、`pause`、`hold` 由第 70 步处理
- 同一个角色、同一种语言，整期用同一个声音；选定后记进 `data/profile.md`，以后沿用
- 克隆声音只用本人同意的参考音

**自检**：文件数 = 句数；抽听几句，没有吞字、读错
