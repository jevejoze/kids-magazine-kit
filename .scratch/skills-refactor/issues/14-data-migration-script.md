# 14: 数据迁移脚本

**What to build:** 维护者在数据仓库副本上跑一次迁移脚本，旧期文件、反馈、档案、声音配置都转成新格式，新引擎渲染全部旧期和 v1 基线逐像素一致。

**Blocked by:** 13

**Status:** ready-for-agent

- [ ] 期内文件改成 skill id 命名；单文件旧期和 legacy 保持原样
- [ ] 反馈的 favorite / dislike 映射成 skill id，原话保留
- [ ] 四份 markdown 档案拆成各栏目 config.md 和 log.jsonl
- [ ] profile 开头的刊名、称呼、send_note 和 voices 配置并入 magazine.yaml；思维课表移进 curriculum
- [ ] 脚本可重复运行，第二次运行无改动
- [ ] 迁移后全部旧期和 v1 基线逐像素一致
