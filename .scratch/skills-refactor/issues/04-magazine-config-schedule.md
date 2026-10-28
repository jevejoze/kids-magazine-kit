# 04: magazine.yaml + 调度写 brief.sections

**What to build:** 家长用一份 magazine.yaml 写栏目列表与顺序、星期主题、周五轮换、cast、image_policy、声音；调度脚本按配置和日期算出本期栏目、顺序和参数，写进 brief 的 sections，替代步骤表里的 when / optional。

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] 子集 YAML 解析器（map、list、标量）有 fixture 测试，遇到不支持的语法报清楚的错
- [ ] magazine.yaml 校验：未知栏目、未声明参数、越界参数都报错
- [ ] 调度对 demo 的周一、周五、普通日分别算出和现有 when / optional 一致的栏目集
- [ ] manifest 参数表（类型、默认值、范围）合并进 `sections.<id>.params`；首批只开放周五轮换、image_policy、讲读句数上限
- [ ] 课表存在时按周注入相关栏目的 params，不存在时用默认值
- [ ] assemble 结果和旧版结构一致
