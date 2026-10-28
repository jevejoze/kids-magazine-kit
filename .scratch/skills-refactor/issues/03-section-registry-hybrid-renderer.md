# 03: 栏目注册表 + 混合渲染器 + pages.json

**What to build:** 引擎能从引擎和数据仓库两处读出栏目包，校验 manifest；渲染时注册表里有的栏目走 page.js + page.css，其余仍走旧模板；每次渲染输出 pages.json（第几张卡是哪个栏目）。

**Blocked by:** 02

**Status:** ready-for-agent

- [x] 注册表读两处 `sections/`，同名报错，manifest 缺字段或类型不对报错
- [x] 抽出共用版式 kit 对象（顶栏、页脚、角色、气泡、中文断行、目录、下页预告、cast），旧模板改用它
- [x] page.css 选择器必须以 `#<skill-id>` 开头，静态检查能报出违规选择器
- [x] 注册表为空时，全部旧期渲染和 v1 基线逐像素一致
- [x] 渲染输出 pages.json，流水线测试覆盖它和讲读卡号的一致性
