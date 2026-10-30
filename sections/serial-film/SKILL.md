# 经典连载 · 放映室（serial-film）

周五（艺术日）连载停一天，信箱前面这一页换成「放映室」：介绍一部电影，配 3 个边看边找的小任务。页位是 `serial`，本期 `kind` 是 `film` 时由这个包出；周五出哪一种由 `magazine.yaml` 的 `schedule.friday.serial` 轮换表决定，brief 这一步写进任务书 `sections.serial.params.kind`。

## 开工

1. 领任务单：`node scripts/pipeline.mjs ticket <issue> serial`（或 `serial-film`），照单上的规则、参数、角色槽位写；最后一行的指纹写进 `_meta.ticket`
2. 读任务单「要读、要更新的状态」里的文件：
   - `state/serial-film/config.md`：家长写的片单、偏好
   - `state/serial-film/log.jsonl`：出过的，一期一行，别重复
   - 数据目录还没有 `state/serial-film/` 时，片单在旧档案 `serial-bible.md`「周五片单」
3. 写 `issue/serial.json`，字段见同目录 `schema.json`

```json
{
  "_meta": {"stage": "serial", "by": "", "at": "", "ticket": "<任务单指纹>"},
  "kind": "film",
  "title_zh": "……", "title_en": "……",
  "by": "导演 · 年份 · 片长 · 年龄分级",
  "photo_url": "……", "photo_credit": "……", "photo_pos": "center",
  "paragraphs": ["……"],
  "tasks": ["……第几分钟、哪个角色做了什么", "……", "……"],
  "crew": {"who": "mouse:happy:130", "say": "In London, I saw it live!"},
  "where": "给家长：去哪个平台看、选哪个版本、多长、年龄分级",
  "tbc": "下周五：……",
  "summary": "一句话：出了什么，归档写进 log.jsonl"
}
```

## 规则

- 优先和正在连载的书或孩子的兴趣呼应
- `paragraphs` ≤ 180 字：这是什么、讲了什么或描绘了什么、为什么值得看；不剧透电影结局
- `tasks` 正好 3 个边看边找或看完回答的小任务，要具体（哪个乐器、第几分钟、哪个角色做了什么）
- `crew` 一位编辑部成员说一句（≤ 20 字）
- 歌词、台词只介绍，不转载；作品里的角色只提名字，编辑部不画它们
- 配图用官方剧照、海报或演出照片：和新闻原图一样只放在私有数据目录（`image_policy: private-ok`），`photo_credit` 写清来源。全刊 `image_policy: free-only` 时轮换表不能排 `film`，`magazine.yaml` 校验会报错
- `where` 写给家长：去哪里找、选哪个版本、多长；注明年龄分级

## 图片

assets 这一步把 `photo_url` 下载成 `assets/serial-film/serial.jpg`（`node scripts/assets.mjs fetch <url> <issue>/assets/serial-film/serial.jpg --min 800 --max 1600`），`assets.json` 的 `serial` 写 `serial-film/serial.jpg`。

## 状态

本步只写 `serial.json`。archive 这一步归档时：有 `state/serial-film/` 就把 `summary` 追加进 `log.jsonl`；旧数据目录照旧写 `bible_update`（追加到 `serial-bible.md`「周五片单」的一行）。

## 自检

`node scripts/pipeline.mjs check <issue>` 没有 `[serial]` 报错；字数；任务看得出来、答案在作品里。
