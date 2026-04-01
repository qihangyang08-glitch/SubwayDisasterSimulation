# 数字孪生地铁灾害应急仿真系统（UE4.26）

更新时间：2026-04-01

本项目当前联调形态为三部分：

1. UE 客户端（Pixel Streaming 推流端）
2. 前端信令服务（Cirrus，端口 8080/8888）
3. 中台服务（Node.js + MySQL，端口 3100）

如果你是新接手同学，请先看下方文档索引，再按运行手册执行。

## 一、推荐阅读顺序

1. [系统详细讲解](./SYSTEM_DETAIL.md)
2. [环境配置与安装](./ENV_SETUP.md)
3. [联调测试运行手册](./VISUAL_TEST_RUNBOOK.md)
4. [事项说明与待办决策](./NOTES_AND_DECISIONS.md)
5. [过程文档总索引](./DOCS/PROCESS/INDEX.md)

## 二、快速启动（用于已配置完成环境）

1. 启动中台服务（PROJECT/MIDDLEWARE/server）

```powershell
npm install
npm start
```

2. 启动前端信令服务（PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer）

```powershell
npm install
npm start
```

3. 启动 UE（PROJECT/UE_PROJECT）

```powershell
Start-Process ".\PixelDemo.exe - 快捷方式.lnk"
```

4. 打开页面

- http://localhost:8080/

完整步骤、连通性快检和故障排查请见 [VISUAL_TEST_RUNBOOK.md](./VISUAL_TEST_RUNBOOK.md)。

## 三、目录说明（交接视角）

- PROJECT/UE_PROJECT: UE 可执行程序启动入口（当前仓库以快捷方式方式保留启动点）
- PROJECT/FRONT_UE: 前端 UI 与 SignallingWebServer
- PROJECT/MIDDLEWARE: 中台服务与数据库脚本
- PROJECT/DOCS/PROCESS: 过程性资料集中索引（会议纪要、阶段报告、执行清单、审计过程）
- PROJECT/_backup: 历史脚本与旧启动方案备份

## 四、当前阶段状态

- 已完成：三部分基本互通；前端创建仿真页面和历史页完成二轮细化；基础联调通过。
- 未完全闭环：
    - 端到端“操作即落库”证据链仍需按测试清单逐项补齐。
    - 历史页数据分析目前为交互占位，尚未接入真实绘图与计算。
    - 特殊实体固定位置编号等配置能力尚未沉淀为中台统一下发机制。

## 五、文档治理约定

- 根目录保留对外使用文档：系统说明、环境配置、测试步骤、事项说明。
- 过程性文档统一通过 [DOCS/PROCESS/INDEX.md](./DOCS/PROCESS/INDEX.md) 收口管理。
- 新阶段补充报告请优先放入 DOCS/PROCESS，并在索引中登记。
