# 90 更新档案

**读**：`issue/30-issue.json`、`issue/13-story.json`（`summary`、`threads_after`；旧数据目录是 `bible_update`）、`issue/18-serial.json`（`bible_update`）、`issue/09-creature.json`（周一才有，`log_update`）、`issue/08-think.json`（周五才有，`log_update`）

**助手脚本**：先运行下面的命令，它会只追加地更新 `vocab.json`、小剧场状态（`state/story/log.jsonl` 追加本集一行、`open-threads.md` 按 `threads_after` 重写；旧数据目录追加 `story-bible.md`）、`serial-bible.md`、`creature-log.md`、`think-log.md`，按固定文件名把页图、PDF 和有效的讲读版复制到 `data/成品/NNN/`，最后打印一行归档回执。第 40 步未完成或已过期时脚本会停下。脚本不改 `story-bible.md` 的"未回收伏笔"和 `profile.md`，也不碰 git 和网盘，这几件照下面的要求自己做。
```bash
node scripts/pipeline.mjs archive <issue>
```

**写**
- `data/vocab.json`：做了单词屋时追加本期 3 个单词 `{"word", "cn", "issue"}`；没做就跳过
- 小剧场：脚本已写好 `state/story/`；旧数据目录的 `data/story-bible.md` 由脚本追加本集摘要，"未回收伏笔"自己更新
- `data/serial-bible.md`：把 `18-serial.json` 的 `bible_update` 追加到「进度」（书）或「周五片单」（音乐盒、放映室、动手做）；一本书讲完，标记"已完结"，提醒家长选下一本
- `data/creature-log.md`：周一把 `09-creature.json` 的 `log_update` 追加到「已发档案」（编号、怪物、原型、期号）
- `data/think-log.md`：周五把 `08-think.json` 的 `log_update` 追加到「已用」（日期、话题、期号）
- `data/profile.md`：本期调整过英文档位等设定时记一行，注明依据

**推送和上传核对**
- 数据仓库：写完 `90-archive.json` 后 `sync.sh push "NNN: 出刊"`，`sync.sh check` 返回 0；`issues/NNN/` 里 00–50 步的 JSON、`11-diagram.svg`、`31-review.md`、`20-assets/` 全部图片都在提交里
- 网盘 `成品/NNN/`：全部 card-N.png（平时 8 张，周一、周五 9 张）、`<刊名>-第NNN期.pdf`、`<刊名>-第NNN期-讲读版.mp4`（文件名照抄，旧名字的文件改成这个名字）

**规则**：只追加，不删除已有记录

核对并更新完档案后，写 `issue/90-archive.json`，列出本期实际更新的档案（路径相对数据目录），用于流水线判断归档是否完成。不要提前写；文件清单检查不能替代上述推送和网盘核对。

```json
{"issue": 3, "content_hash": "<当前内容指纹>", "updated": ["state/story/log.jsonl", "state/story/open-threads.md", "serial-bible.md"]}
```

**自检**：`sync.sh check` 返回 0，网盘 `成品/NNN/` 的文件都齐了，告诉家长成品在网盘的哪个文件夹
