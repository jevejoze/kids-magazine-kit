# 02: 渲染可复现 + 像素回归基线

**What to build:** 维护者跑一条回归命令，就能把数据目录里全部目录格式的旧期用当前引擎渲染出来，并和基线逐张逐像素比对，报告哪期哪张不一致。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 同一引擎连渲两遍全部旧期，逐像素一致；有浮动（字体、动画、时间戳）先修掉
- [x] 回归命令支持「出基线」和「和基线比对」两种用法，比对基于解码后的像素，零新依赖
- [x] 同时比对新旧 assemble 产出的整期 JSON 结构
- [x] 基线和对比结果只写本地输出目录，kit 测试只用 demo fixture
- [x] v1 基线建好并记录在本地

## 结果（2026-10-29）

- 命令：`node scripts/regress.mjs baseline|compare …`，像素用 ffmpeg 解码成 rgba 取 md5；`render.mjs --preview --allow-overflow` 让溢出的旧期（007、015、017）照常截图
- 浮动：串行和 3–8 路并发都稳定；12 路并发时约 2/12 出抗锯齿略有不同的一版（拉丁字形边缘）。对策：只开 2 路，出基线每期渲两遍须一致，比对不一致重渲一次
- v1 基线：本地 `output/regress/v1`，003–005、007–020 共 17 期（006 是单文件）。020 未完成、渲染失败，基线记录同样的报错；003、004、012、016 缺源稿，整期 JSON 记为 `_error`
- 复核：`compare` 到 `output/regress/v1-check`，17 期全部一致
