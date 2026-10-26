# 60 语音

**目标**：把 `50-narration.json` 里每一句合成成音频。

**默认做法**：Azure 语音

```bash
node scripts/tts_azure.mjs <issue> --dry   # 先看这期要用多少计费字符
node scripts/tts_azure.mjs <issue>         # 合成；已经合成过、内容没变的句子会跳过
```

- 环境变量：`AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`（免费 F0 资源）；可选 `AZURE_SPEECH_KEY_PAID`、`AZURE_SPEECH_REGION_PAID`（同一订阅下的付费 S0 资源，免费额度用完或被限流时自动接着用）
- 计费：免费档每月 50 万计费字符，汉字算 2 个，SSML 标签也算（`<speak>` `<voice>` 除外）。脚本只给有情绪的句子加风格标签，慢速、停顿、重复都交给第 70 步，一期约 0.8 万计费字符（含多音字注音）
- 免费资源每分钟最多 20 次请求，脚本会自动放慢，一期大约 10 分钟
- 声音：`data/voices/azure.json` 写每个角色每种语言用哪个声音，没写的用脚本里的默认值；换声音前先 `node scripts/tts_azure.mjs --audition <数据目录>` 试听，试听文件在 `data/voices/试听/`
- 音色：`azure.json` 里写 `{"voice": "声音名", "pitch": 3}` 可以在合成后升降几个半音，让声音更卡通，不占计费字符（需要 ffmpeg）
- `emotion` 对应 Azure 的说话风格：开心、惊讶 → cheerful，兴奋 → excited，委屈 → sad，紧张 → fearful，温柔 → gentle，神秘 → whispering；平静、困倦、得意不加。声音不支持的风格按普通语气念

**克隆声音（可选）**：数据目录有 `voices/voicestudio.json` 时，Azure 跑完再跑一步，把指定角色的句子换成 VoiceStudio（OmniVoice）克隆的声音：

```bash
node scripts/tts_voicestudio.mjs <issue> --dry   # 看要替换几句
node scripts/tts_voicestudio.mjs <issue>         # 替换；已替换、正文没变的句子跳过
```

- 配置写法：`{"narrator/zh": "parent", "narrator/zh@serial": "parent-reading", "profiles": {"parent": ["本机 id", "另一台机器的 id"]}}`。键是"角色/语言"，加 `@serial` 只用于经典连载（读书）那一页；`profiles` 列出档案在各台 VoiceStudio 上的 id，脚本按顺序试
- 环境变量 `VOICESTUDIO_URL`，默认 `http://127.0.0.1:3900`；远程机器用 `ssh -L 3900:127.0.0.1:3900` 转到本地
- VoiceStudio 在 CPU 上很慢（一句一两分钟），可以随时中断重跑；单句失败保留 Azure 版，连不上时退出码 3，Azure 版整期照样能用
- 每次重跑 Azure 或 MiMo 之后都要再跑一次这一步：它们会复用克隆句的音频，但把声音说明改回 Azure 的，制作记录也由这一步来写
- 克隆档案的参照音频是本人的声音，只放在私有数据目录 `voices/clone/`

**MiMo 语音（可选）**：数据目录有 `voices/mimo.json` 时，用小米 MiMo 合成整期，代替 Azure（这时 `tts_azure.mjs` 会直接退出，要用加 `--azure`）。有 `voices/voicestudio.json` 时，跑完 MiMo 照样再跑 `tts_voicestudio.mjs` 换克隆声音，MiMo 重跑时会复用换好的克隆句：

```bash
node scripts/tts_mimo.mjs --audition <数据目录>   # 每个角色合成一句试听，写到 voices/试听/mimo-*.wav
node scripts/tts_mimo.mjs <issue> --dry           # 看要合成几句、每个角色用哪个声音
node scripts/tts_mimo.mjs <issue>                 # 合成；已合成、内容和声音没变的句子跳过，可随时中断重跑
```

- 环境变量 `MIMO_API_KEY`（可选 `MIMO_BASE_URL`，默认 `https://api.xiaomimimo.com/v1`）
- 配置写法：`{"narrator/zh": {"clone": "clone/parent/ref.wav"}, "narrator/zh@serial": {"clone": "clone/parent-reading/ref.wav"}, "dog/zh": {"voice": "苏打", "style": "憨憨的小男孩，慢悠悠的"}}`。键是"角色/语言"，加 `@serial` 只用于经典连载（读书）那一页；`voice` 是 MiMo 内置音色（中文 冰糖 茉莉 苏打 白桦，英文 Mia Chloe Milo Dean），`clone` 是相对 `voices/` 的参照音频（wav 或 mp3，base64 后 ≤ 10MB），用 `mimo-v2.5-tts-voiceclone` 克隆；`style` 是这个角色的语气说明，`pitch` 合成后升降半音（需要 ffmpeg）
- `emotion` 写成句首的风格标签，如"(开心)"；MiMo 不支持注音，多音字读错时回第 50 步换个说法
- 单句失败会重试 5 次，仍失败就退出码 1，重跑只补缺的句子
- MiMo 自己的克隆（`clone`）音质不稳，家长的声音优先用 VoiceStudio

换别的语音服务也可以，产出按下面的约定放好即可。

**读**：`issue/50-narration.json`、`data/voices/azure.json`（可选）、`data/voices/mimo.json`（可选）

**写**：`issue/60-audio/` 下每句一个文件，命名 `c{card}_{序号}.wav`（序号是这句在该页 `lines` 里的位置，从 0 开始，两位数，如 `c3_04.wav`），外加 `issue/60-audio/manifest.json`：

```json
{"_meta": {"stage": "60-audio", "by": "", "at": ""},
 "voices": {"dog/zh": "所用的声音", "mouse/en": "……"},
 "files": [{"card": 1, "index": 0, "file": "c1_00.wav", "seconds": 3.2}]}
```

**多音字**：Azure 常把多音字读错（如"在行"读成 zài xíng）。脚本合成时会自动给词典里的词加注音：
- 通用词典 `scripts/polyphones.json`；孩子数据目录的 `voices/polyphones.json` 补充或覆盖，写法一样：`{"在行": "zai4 hang2"}`
- 单句临时注音写在讲读稿那一句的 `pron` 字段，优先级最高
- 合成前先跑 `node scripts/tts_azure.mjs <issue> --pinyin`，它会列出还没注音的多音字（用【】标出）。逐条确认：会读错的就给那一句加 `pron`，以后还会用到的词加进 `voices/polyphones.json`，确认没问题的词加进词典的 `_ok` 列表，直到提示"没有待确认的多音字"
- `--dry` 会显示这期注音了几处，并给一个 SSML 示例。注音标签也算计费字符，一期大约多两三千

**规则**
- 每句按正常语速合成一遍即可；`repeat`、`rate`、`pause`、`hold`、`sfx` 由第 70 步处理
- 同一个角色、同一种语言，整期用同一个声音；选定后记进 `data/profile.md`，以后沿用
- 用克隆声音时，只用本人同意的参考音

**恢复与版本**：Azure 每完成一句就保存音频和 manifest，manifest 的 `_meta.complete` 在整期完成前为 `false`。失败后重跑同一命令；已合成、正文和声音未变且文件完整的句子会复用。完成后写 `60-audio/build.json`，记录输入版本和产物校验和。声音配置、词典或讲读稿变化会使旧制作记录过期。

使用其他语音服务时，完成全部音频后调用 `scripts/build-state.mjs` 的 `inputFingerprint` / `recordBuild` API 保存同样的制作记录；采集指纹必须在制作前，制作期间输入变化时拒绝记录。

**自检**：`--pinyin` 显示没有待确认的多音字；文件数 = 句数；抽听几句，没有吞字、读错
