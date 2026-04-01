# 环境配置与安装

更新时间：2026-04-01

## 1. 适用范围

本文用于在 Windows 环境下完成本项目联调所需基础环境，并验证三部分可启动。

## 2. 前置依赖

1. Node.js 16+
2. npm 8+
3. MySQL 5.7+（建议 8.x）
4. UE4.26 打包产物或可执行启动入口
5. 浏览器（Chrome/Edge）

## 3. 数据库准备

1. 启动 MySQL 服务。
2. 创建数据库（若已存在可跳过）。
3. 执行表结构脚本：
- PROJECT/MIDDLEWARE/db/sql/module1_schema.sql

可参考：
- PROJECT/MIDDLEWARE/db/QUICK_START.md
- PROJECT/MIDDLEWARE/db/INDEX.md

## 4. 中台服务配置与启动

目录：PROJECT/MIDDLEWARE/server

说明：
- 端口读取 `MIDDLEWARE/server/.env` 的 `PORT`，当前仓库值为 `3100`。
- 若未提供 `PORT`，代码默认监听 `3000`。

```powershell
npm install
npm start
```

默认健康检查：

```powershell
Invoke-WebRequest -Uri http://localhost:3100/healthz -Method GET
```

期望：payload.db.status = ok。

## 5. 前端信令服务配置与启动

目录：PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer

```powershell
npm install
npm start
```

当前 start 脚本会执行 node cirrus.js。

期望日志包含：

- Http listening on *: 8080
- WebSocket listening to Streamer connections on :8888
- WebSocket listening to Players connections on :8080

## 6. UE 启动

目录：PROJECT/UE_PROJECT

```powershell
Start-Process ".\PixelDemo.exe - 快捷方式.lnk"
```

若需要直接 exe 启动，需在 WindowsNoEditor 目录中执行并带上 Pixel Streaming 参数，且 Start in 路径正确。

## 7. 快速连通性检查

```powershell
Test-NetConnection 127.0.0.1 -Port 3100
Test-NetConnection 127.0.0.1 -Port 8080
Test-NetConnection 127.0.0.1 -Port 8888
Invoke-WebRequest -Uri http://127.0.0.1:8080/ -Method GET
Invoke-WebRequest -Uri http://127.0.0.1:3100/healthz -Method GET
```

## 8. 常见问题

1. EADDRINUSE 端口占用
- 先停止占用 3100/8080/8888 的旧进程，再重启服务。

2. 浏览器提示 Streamer 未连接
- 说明前端到 Cirrus 通，但 UE 未连上 8888。

3. npm install 出现 package-lock 权限问题
- 按 VISUAL_TEST_RUNBOOK 的 attrib + 重命名方案处理。

## 9. 详细联调步骤

完整测试步骤请直接执行：
- PROJECT/VISUAL_TEST_RUNBOOK.md
