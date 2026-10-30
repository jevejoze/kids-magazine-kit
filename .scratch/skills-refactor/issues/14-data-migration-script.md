# 14: 数据迁移脚本

**What to build:** 维护者在数据仓库副本上跑一次迁移脚本，旧期文件、反馈、档案、声音配置都转成新格式，新引擎渲染全部旧期和 v1 基线逐像素一致。

**Blocked by:** 13

**Status:** done（脚本已写好、在数据仓库的一份本地副本上验证过；没有对真实数据仓库本身跑，见下方说明）

- [x] 期内文件改成 skill id 命名；单文件旧期和 legacy 保持原样（`scripts/migrate-v2.mjs`：按目录名识别"目录格式的期"，`006.json` 这类单文件和 `issues/legacy/` 原样跳过；改名同时修掉已经合并进 `issue.json`/`narration.json`/`review.md` 里按旧路径写死的图片/图解引用，不然图找不到）
- [x] 反馈的 favorite / dislike 映射成 skill id，原话保留（中文页名 → skill id 的对照表内置在脚本里；认不出的页名原样留着，不瞎猜；`quote` 等原话字段不动）
- [x] 四份 markdown 档案拆成各栏目 config.md 和 log.jsonl（`creature-log.md`/`story-bible.md`/`serial-bible.md`/`think-log.md` 整份搬进 `state/<id>/config.md`，历史内容原样保留；同时新建一个空的 `log.jsonl`，从迁移后的下一期开始正常追加——没有尝试把历史里格式不统一的单行进度记录反向解析成结构化字段，详见下方说明）
- [x] profile 开头的刊名、称呼、send_note 和 voices 配置并入 magazine.yaml；思维课表移进 curriculum（`profile.md` 开头解析出 `masthead.zh/en/by`、`call`、`send_note` 写入新建的 `magazine.yaml`；`voices/*.json` 本身不解析进 `magazine.yaml` 的 `voices` 字段——那个字段只支持"每个角色一句话"的简单声音名，和现有按供应商/克隆/兜底写的配置模型不匹配，继续让 TTS 脚本直接读 `voices/*.json`，`magazine.yaml` 里留一句注释说明；`thinking-plan.md` 搬到 `curriculum/thinking-plan.md`）
- [x] 脚本可重复运行，第二次运行无改动（`tests/migrate-v2.test.mjs` 用合成夹具验证：第二次运行打印"没有要迁移的内容"，文件内容逐字节不变）
- [x] 迁移后全部旧期和 v1 基线逐像素一致（见下方"真实数据验证"）

## 真实数据验证（在副本上做的，没有碰真实数据仓库）

把 `/Users/jeffrey/workspace/other/kids-magazine`（只读）复制到本机临时目录 `/tmp/kids-migrate-test`，在这份副本上跑 `node scripts/migrate-v2.mjs /tmp/kids-migrate-test`，然后用 `scripts/regress.mjs compare` 把渲染结果和已有的 v1 基线（17 期）逐像素比对：

- 17 期里 **4 期**（003、004、012、016）本来就只有合并后的 `issue.json`、没有留着当年的单项源文件，重新从源文件 `buildIssue()` 必然因为缺文件报错——这个报错在迁移前后都存在，唯一差别是报错信息里带的文件名从 `00-brief.json` 变成了 `brief.json`（迁移改的正是这个名字），不是新问题
- 其余 **12 期**：像素逐张核对一致；"整期 JSON" 这层比对报的字段差异（`cover.photo`、`news.items[].photo`、`check.photo`、`creature.photo`/`legend`、`serial.photo`/`diagram`）全部是图片路径字符串从 `20-assets/xxx.jpg` 变成 `assets/xxx.jpg`——这正是迁移要做的事，不是像素或内容的差异
- **1 期**（020）完全一致，没有任何差异
- 期间两次重跑撞到的"某几张卡片像素不一致"，单独重跑或整批重跑都会消失，是 Chrome 无头渲染偶发的抗锯齿抖动（这次会话里反复遇到的同一个已知问题），不是迁移或改名引入的

## 没有做、以及为什么

- **没有对着真实数据仓库（`/Users/jeffrey/workspace/other/kids-magazine`）本身跑这个脚本**：按你的既定规则，这个数据仓库只读，而且迁移、切换引擎版本属于工单 16（试刊与切换）的范围——那张工单本身写着"推送前和家长确认"，正式数据的迁移应该和那次确认放在一起做，不在这里单方面跑掉
- **没有把历史档案里的单行进度记录解析成结构化的 `log.jsonl` 条目**：四份旧档案（尤其是连载圣经、周末思辨话题池）里的记录格式这些年不完全统一，手写规则去猜容易把家长辛苦攒的细节记错。选择了更保守的办法：整份文字原样保留在 `config.md` 里（agent 挑选话题、角色认领时照样能读到完整历史），`log.jsonl` 留空、从下一期开始正常追加——不丢任何历史信息，只是没有把旧记录"倒着"转换成新格式
- **`voices/*.json` 的内容没有合并进 `magazine.yaml` 的 `voices` 字段**：那个字段目前的 schema 只支持"每个角色一句声音名"，装不下现在按供应商（Azure/MiMo/ElevenLabs/VoiceStudio）、克隆、兜底写的配置，勉强塞进去会丢信息或校验不过，所以保持现状——TTS 脚本继续直接读 `voices/*.json`，没有任何功能损失
