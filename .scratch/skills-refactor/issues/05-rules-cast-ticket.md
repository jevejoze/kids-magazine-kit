# 05: 规则拆文件 + cast 槽位 + ticket 命令

**What to build:** agent 用 `ticket <issue> <skill>` 拿到一份拼好的任务单：红线、声明的规则、cast 槽位映射、brief 全局字段、params、state 路径、consumes 的值、输出路径；输出里记下任务单指纹，上游变了 check 就标过期。

**Blocked by:** 04

**Status:** done

- [x] 总规则拆成独立规则文件（红线、图片、英文档位、讲读、no-visible-pedagogy），根 SKILL.md 引用它们
- [x] cast 包把槽位（asker、expert、english、trickster、narrator）映射到角色；少于 2 个角色或槽位没人担报错
- [x] 红线和 cast 隐式进入每张任务单，声明里去不掉
- [x] 任务单指纹稳定：输入不变指纹不变，任一输入变了指纹就变
- [x] `_meta.ticket` 与当前任务单不符时，status / check 把这一步标成过期
