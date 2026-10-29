# 07: 打样：经典连载拆成四个 skill

**What to build:** 经典连载拆成连载书、音乐盒、放映室、动手做四个栏目包，周五轮换由编排决定；每个栏目在自己那一步下载图片，授权策略和杂志 image_policy 对照检查。

**Blocked by:** 06

**Status:** ready-for-agent

- [x] 四个栏目包齐全，共用版式放进 kit 对象
- [x] 周五出哪个由 magazine.yaml 的轮换表决定
- [x] 图片下到 `20-assets/<skill-id>/`，用共享下载模块
- [x] manifest 声明 free-only / private-ok，和 image_policy 冲突时报错
- [x] 折纸图式拆分移进动手做栏目
- [x] 普通日和周五旧期像素一致
