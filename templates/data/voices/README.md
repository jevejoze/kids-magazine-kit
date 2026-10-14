# 讲读版声音

`azure.json` 写每个角色每种语言用哪个 Azure 声音，没写的用 `scripts/tts_azure.mjs` 里的默认值。声音名称在 Speech Studio 的声音库里查。

```json
{"narrator/zh": "zh-CN-XiaoxiaoNeural", "narrator/en": "en-GB-SoniaNeural",
 "dog/zh": "zh-CN-YunxiaNeural",
 "mouse/zh": "en-GB-AdaMultilingualNeural", "mouse/en": "en-GB-MaisieNeural",
 "owl/zh": "zh-CN-YunyeNeural", "owl/en": "en-GB-RyanNeural",
 "raccoon/zh": "zh-CN-YunxiNeural", "raccoon/en": "en-GB-ElliotNeural"}
```

换声音前先试听：`node scripts/tts_azure.mjs --audition <数据目录>`，每个角色合成一句，放在 `voices/试听/`。定下来后记进 `profile.md`。
