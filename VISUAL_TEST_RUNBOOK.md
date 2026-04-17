# 可视化联调测试运行手册（无快捷脚本依赖）
VISUAL_TEST_RUNBOOK
更新时间：2026-04-17

## 1. 本次整理结论

- 中台数据库初始化已内建到服务启动流程，无需额外初始化脚本。
- UE 启动改为直接运行可执行程序并传递 Pixel Streaming 参数。
- 前端信令服务改为直接运行 `node cirrus.js`。
- 已将信令 Web 端口固定为 `8080`（避免 `80` 端口冲突），Streamer 端口固定为 `8888`。
- 中台端口由 `MIDDLEWARE/server/.env` 的 `PORT` 决定，当前仓库为 `3100`（代码默认值为 `3000`）。

### 1.1 本轮前端改动记录（2026-04-01）

为进入第二轮开发（项目细化、漏洞修复、整体测试），已完成以下前端改造并联调通过：

1) 创建仿真页面细化（按 DataStruction）
- 新增/补齐 `InitConfig` 关键配置项：`scenarioId`、`mapLevel`、`seed`、`totalPeople`、`disasters`、`specialEntities`、`ext`。
- `scenarioId` 增加随机生成（按钮触发），避免用户手填。
- 灾害参数改为条件显示：仅在勾选 `water`/`fire` 后显示对应参数区。
- 特殊实体新增流程改为：点击“+”先选择 `device` 或 `staff`，再插入实体卡片并编辑参数。
- `device` 使用固定 ID 池（当前预设 5 个，后续可在脚本常量调整）；当 `device` 数量达上限时，新增类型选择中自动禁用 `device` 选项。

2) 兼容性修复（控制台报错）
- 修复 `app.js` 在新 UI 下访问旧 DOM 节点导致的空指针：
	- `onDataChannelMessage` / `InitialSettings` 分支：对编码器与 WebRTC 设置项改为“节点存在才写入”。
	- `onAggregatedStats` 分支：对 `qualityStatus` 与 `stats` 元素增加空值保护后再设置 `className/style/innerHTML`。
- 解决的典型报错：
	- `Cannot set properties of null (setting 'value')`
	- `Cannot set properties of null (setting 'className')`

3) 历史数据页面细化（第二轮项目细化新增）
- 侧边栏“历史数据”从弹窗模式调整为打开独立页面：`/history.html`（新窗口）。
- 新增历史数据独立页面布局：左侧仿真历史列表，右侧时间顺序数据列。
- 历史列表读取接口：`GET /api/simulations`；选中仿真后读取 `GET /api/simulations/:simId/info`，并按时间采样查询 `GET /api/simulations/:simId/frame?time=...` 形成演示型时序表格。
- 页面顶部新增“数据分析”按钮，支持图表类型选择：曲线图、热点图、柱状图、散点图（后续接入真实绘图能力，本轮仅占位）。
- 曲线图提供示例性配置交互：
	- 横轴：单选；
	- 纵轴：多选；
	- 选项来源于 `FrameSnapshot` 相关参数（如 `simTime`、`frameIndex`、`statistics.*`、`environment.zones.*`、`agents.*`、`specialEntities.*`）。
	- 当前仅演示“配置链路与选择结果回显”，不做真实绘图。

4) 涉及文件（便于回归）
- `PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer/www/player.html`
- `PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer/www/app-shell.css`
- `PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer/scripts/app-shell.js`
- `PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer/scripts/app.js`
- `PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer/www/history.html`
- `PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer/www/history-page.css`
- `PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer/scripts/history-page.js`

5) 回归建议
- 打开 `http://localhost:8080/`，执行“创建仿真 -> 订阅 -> 播放/暂停/拖动时间轴”，确认无新增前端报错。
- 在浏览器控制台重点关注是否再次出现上述两类 `null` 赋值异常。
- 点击侧边栏“历史数据”，确认可打开 `http://localhost:8080/history.html`。
- 在历史页验证以下链路：
	- 左侧列表可加载并显示仿真记录；
	- 点击某条记录后，右侧可展示按 `simTime` 升序的时间序列数据；
	- 打开“数据分析”后，切换图表类型时占位提示正常；
	- 选择曲线图时，横轴单选与纵轴多选可正常回显配置结果。

## 2. 已备份的旧快捷脚本

备份目录：`PROJECT/_backup/pre-visual-test-20260331`

已迁移：
- `MIDDLEWARE/server/scripts/init-db.js`
- `MIDDLEWARE/server/scripts/check-db.js`
- `MIDDLEWARE/server/scripts/init-module1-db.js`
- `MIDDLEWARE/server/scripts/examples.js`
- `UE_PROJECT/MyProject/WindowsNoEditor/run_pixelstreaming.bat`

说明：如需回退，可将对应文件移回原路径。

## 3. 启动顺序（建议）

### 步骤0：清理残留进程与释放端口（重测必备）
每次重新测试前，若遇到 `EADDRINUSE` 端口占用报错或画面卡死，说明旧的服务仍在后台运行。请先在 PowerShell 中执行以下命令，一键删去正在运行的进程，释放 `3100`、`3200`、`3300`、`8080` 和 `8888` 端口：

```powershell
# 强制杀死占用相关端口的 Node 服务进程
Get-NetTCPConnection -LocalPort 3100,3200,3300,8080,8888 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

# 强制杀死可能卡在后台的 UE 进程
Stop-Process -Name "ueProj" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "PixelDemo" -Force -ErrorAction SilentlyContinue
```

### 步骤A：启动中台

目录：`PROJECT/MIDDLEWARE/server`
```powershell
cd PROJECT/MIDDLEWARE/server
```
```powershell
npm install
npm start
```

启动后检查健康：

```powershell
Invoke-WebRequest -Uri http://localhost:3100/healthz -Method GET
```

期望：返回 `Ack`，其中 `payload.db.status` 为 `ok`。

### 步骤B：启动模拟后端与模拟LLM

目录：`MOCK_SERVICES`
```powershell
cd MOCK_SERVICES
```

终端1（模拟后端）：
```powershell
npm install
npm run start:backend
```

终端2（模拟LLM）：
```powershell
cd MOCK_SERVICES
npm run start:llm
```

期望：
- 输出 `[MockBackend] listening on http://127.0.0.1:3200`
- 输出 `[MockLLM] listening on http://127.0.0.1:3300`

### 步骤C：启动前端信令服务

目录：`PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer`
```powershell
cd PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer
```
```powershell
npm install
npm start
```

期望：日志出现以下监听信息（端口需与此一致）：

- `Http listening on *: 8080`
- `WebSocket listening to Streamer connections on :8888`
- `WebSocket listening to Players connections on :8080`

### 步骤D：启动UE

目录：`PROJECT/UE_PROJECT/PixelDemo/WindowsNoEditor`

```powershell
cd PROJECT/UE_PROJECT/PixelDemo/WindowsNoEditor
.\PixelDemo.exe -PixelStreamingIP=127.0.0.1 -PixelStreamingPort=8888 -AudioMixer -RenderOffscreen
```

说明：
- 直接在 `WindowsNoEditor` 目录启动可以避免快捷方式路径配置错误导致的问题。
- `PixelStreamingPort=8888` 必须和 `FRONT_UE/frontend/WebServers/SignallingWebServer/config.json` 的 `StreamerPort` 一致。
- 若 `Start in` 路径不对，可能出现黑屏、秒退或无法推流。

期望：UE 日志出现成功连接到 signalling server。

### 步骤E：打开前端页面

浏览器访问：

- `http://localhost:8080/`（推荐）
- `http://localhost:8080/player.html`（显式入口）

根据页面中的连接状态进行联通性确认。

### 步骤F：五点连通性快检（新增）

在启动 UE 前先执行：

```powershell
Test-NetConnection 127.0.0.1 -Port 3100
Test-NetConnection 127.0.0.1 -Port 3200
Test-NetConnection 127.0.0.1 -Port 3300
Test-NetConnection 127.0.0.1 -Port 8080
Test-NetConnection 127.0.0.1 -Port 8888
Invoke-WebRequest -Uri http://127.0.0.1:8080/ -Method GET
Invoke-WebRequest -Uri http://127.0.0.1:3100/healthz -Method GET
Invoke-WebRequest -Uri http://127.0.0.1:3200/healthz -Method GET
Invoke-WebRequest -Uri http://127.0.0.1:3300/healthz -Method GET
```

判定标准：
- `3100` 端口失败：中台服务未启动或端口被占用。
- `3200` 端口失败：模拟后端未启动。
- `3300` 端口失败：模拟LLM未启动。
- `8080` 端口失败：前端信令服务未启动或端口被占用。
- `8888` 端口失败：`cirrus.js` 未监听 Streamer 端口。
- 页面能打开但很快提示 `Disconnected: Streamer is not connected`：说明浏览器到 Cirrus 通了，但 UE 没连上 `8888`。

## 4. 数据库操作可视化验证（关键）

### 4.1 前端触发操作

在前端执行以下动作：
- 创建仿真
- 点击“启动模拟仿真”（触发 `POST /api/integration/backend/start`）
- 播放，等待时间轴走到末尾并出现“仿真计算完成”提示
- 在“大模型预案”中点击“生成并应用预案”（触发 `POST /api/integration/llm/plan`）
- 播放/暂停/seek

### 4.2 中台接口快速检查

```powershell
Invoke-WebRequest -Uri http://localhost:3100/api/simulations -Method GET
```

期望：`payload.simulations` 有记录。

### 4.3 MySQL 落库检查

```sql
USE metro_sim;

SELECT sim_id, scenario_id, status, created_at
FROM simulations
ORDER BY created_at DESC
LIMIT 10;

SELECT sim_id, frame_index, sim_time, created_at
FROM simulation_frames
ORDER BY created_at DESC
LIMIT 20;
```

如果前端执行了计划相关操作，再检查：

```sql
SELECT plan_id, from_simulation_id, from_sim_time, created_at
FROM plans
ORDER BY created_at DESC
LIMIT 10;

SELECT plan_run_id, base_simulation_id, plan_id, new_simulation_id, created_at
FROM plan_runs
ORDER BY created_at DESC
LIMIT 10;
```

## 4.4 下一阶段替换验证（真实后端/真实LLM）

当 Mock 服务替换为真实服务后，至少执行以下最小回归：

1. 创建仿真并启动产帧，确认 `simulation_frames` 连续增长。
2. 播放至结束，确认前端收到完成提示且状态可回读。
3. 触发“生成并应用预案”，确认 `plans` 与 `plan_runs` 均有新增。
4. 历史页抽样查看 3 个以上时刻，确认图表输入数据字段完整。

## 5. 失败排查最短路径

- 中台失败：先查 `http://localhost:3100/healthz`。
- UE 无画面：确认 UE 启动参数中的 IP/Port 与 `WebServers/SignallingWebServer/config.json` 一致（建议 `127.0.0.1:8888`）。
- 前端无数据：检查浏览器控制台、`cirrus.js` 控制台和中台控制台是否有错误。
- 前端页面可打开但一直转圈：优先确认访问地址是否为 `http://localhost:8080/`，不要用 `http://localhost/`。
- 浏览器提示 `Disconnected: Streamer is not connected`：这是 UE 未连上信令端口的特征，先检查 UE 参数中的 `-PixelStreamingPort=8888`。
- 端口被占用无法启动：请参考 `3. 启动顺序 -> 步骤0` 中的一键查杀命令，清理后台的残留进程即可。
- `npm install` 报 `EPERM ... package-lock.json`：在 `WebServers/SignallingWebServer` 目录执行下方给出的 `attrib` 与重命名命令后重试。
- `npm install` 显示高风险安全漏洞：运行 `npm audit fix` 自动修复，若提示有 breaking changes 请谨慎使用 `--force`，保留 moderate 漏洞一般不影响本地测试环境。
- UE 启动快捷方式或崩溃问题：
	1) 确保快捷方式名称正确无多余空格（当前仓库示例：`PixelDemo.exe - 快捷方式.lnk`）；
	2) 若近期做过目录迁移，先按“简单回退”处理：
		a) 先关闭所有 UE 进程；
		b) 删除 `ueProj/Saved` 目录（或改名备份）后重试；
		c) 从 `WindowsNoEditor` 目录直接启动，不要跨目录双击；
		d) 使用最小命令重试：`.\ueProj.exe -PixelStreamingIP=localhost -PixelStreamingPort=8888 -AudioMixer`；
		e) 确认 `WindowsNoEditor` 整个目录不是只读，并且当前运行用户有写权限。
- 若以上简单步骤仍失败，再按驱动/引擎兼容方向处理。

```powershell
attrib -R -S -H .\package-lock.json
Rename-Item .\package-lock.json ("package-lock." + (Get-Date -Format 'yyyyMMdd-HHmmss') + ".bak.json")
npm install
```

## 6. UE4.26 重新打包（推荐重建一次）

当项目目录发生迁移、拷贝或重命名后，建议按以下流程重新打包，避免旧路径残留导致运行异常。

1) 在 UE4.26 编辑器中打开原始 uproject。
2) 进入 Project Settings -> Plugins -> Pixel Streaming：
	- 确认插件已启用；
	- 保持默认编码设置，不在此处写死旧机器参数。
3) 进入 Project Settings -> Packaging：
	- Build Configuration 选择 Shipping（测试也可先用 Development 验证）；
	- 勾选 Full Rebuild；
	- 勾选 Use Pak File。
4) 清理历史构建缓存（在项目根目录）：
	- 删除或重命名 Binaries、Intermediate、Saved、DerivedDataCache。
5) 使用 Package Project -> Windows (64-bit) 重新打包。
6) 打包输出建议放到全英文短路径，例如 D:/UEBuild/ueProj/WindowsNoEditor。

## 7. 换路径后正确启动方式（重点）

不要直接从其他目录双击 exe，优先使用以下两种方式之一：

方式A：在 WindowsNoEditor 目录内启动
- 先 cd 到 WindowsNoEditor 目录，再执行 ueProj.exe 启动参数。

方式B：创建快捷方式并设置 Start in
1) 对 ueProj.exe 创建快捷方式。
2) 打开快捷方式属性：
	- 目标 Target 填 exe 完整路径 + 启动参数；
	- 起始位置 Start in 必须填 WindowsNoEditor 目录。
3) 示例：
	- 快捷方式位置：`PROJECT/UE_PROJECT/PixelDemo.exe - 快捷方式.lnk`
	- Target:
	  "D:\UEBuild\ueProj\WindowsNoEditor\ueProj.exe" -PixelStreamingIP=localhost -PixelStreamingPort=8888 -AudioMixer
	- Start in:
	  D:\UEBuild\ueProj\WindowsNoEditor

说明：Start in 配错会导致相对路径资源、插件配置和运行时写入目录解析异常，常见表现就是启动即崩或黑屏。
