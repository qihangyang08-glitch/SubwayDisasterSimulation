# 前端快速启动与验证指南

## 🚀 立即开始

### 步骤1：启动信令服务器
```cmd
cd c:\Users\a\Desktop\双创\PROJECT\FRONT_UE\frontend\SignallingWebServer
node cirrus.js
```

**预期输出**：
```
configFile .\config.json
Config: {
  "UseFrontend": false,
  "UseMatchmaker": false,
  "UseHTTPS": false,
  "UseAuthentication": false,
  "LogToFile": true,
  "HomepageFile": "player.html",
  ...
}
Http listening on *: 8080
```

### 步骤2：打开浏览器
访问：`http://localhost:8080`

### 步骤3：检查控制台
按 `F12` 打开开发者工具，查看Console标签：

**✅ 成功标志**：
```
[Dependency] ✓ WebRTC adapter loaded: {browser: "chrome", version: 130, ...}
[Dependency] ✓ Socket.IO loaded, version: 4.5.4
[Dependency] ✓ All external dependencies loaded successfully
[Dependency] ✓ Loaded: /scripts/webRtcPlayer.js
[Dependency] ✓ Loaded: /scripts/middleware-client.js
[Dependency] ✓ Loaded: /scripts/app.js
[Dependency] ✓ Loaded: /scripts/app-shell.js
[Dependency] ✓ All application scripts loaded
页面已加载，点击连接所有开始联调
```

**❌ 如果看到错误**：
```
[Dependency] ✗ Failed to load Socket.IO from CDN
```
→ 说明CDN被墙，系统会自动尝试本地文件

---

## 🔍 故障排查

### 问题1：页面404
**症状**：浏览器显示"Cannot GET /"

**检查**：
1. 确认服务器启动成功
2. 确认访问地址是 `http://localhost:8080` 或 `http://127.0.0.1:8080`
3. 检查端口是否被占用

**解决**：
```cmd
# 检查端口占用
netstat -ano | findstr :8080

# 如果被占用，修改配置文件
# 编辑 config.json，将 "httpPort" 改为其他端口如 8090
```

### 问题2：stadium.js错误（原问题）
**症状**：控制台显示 `stadium.js:1:2654` 错误

**已修复**✅：新版player.html使用智能加载策略，该错误不应再出现

**如果仍出现**：
1. 清除浏览器缓存（Ctrl+Shift+Delete）
2. 硬刷新页面（Ctrl+F5）
3. 使用无痕模式测试（Ctrl+Shift+N）

### 问题3：依赖加载失败
**症状**：控制台显示 `[Dependency] ✗ Failed to load...`

**原因**：CDN不可用或网络问题

**解决方案A：使用本地Socket.IO**
```cmd
cd c:\Users\a\Desktop\双创\PROJECT\FRONT_UE\frontend\SignallingWebServer

# 如果已有node_modules，直接复制
copy node_modules\socket.io-client\dist\socket.io.min.js public\socket.io.min.js

# 如果没有，先安装
npm install socket.io-client@4.5.4
copy node_modules\socket.io-client\dist\socket.io.min.js public\socket.io.min.js
```

**解决方案B：使用代理**
```cmd
# 设置npm代理
npm config set proxy http://your-proxy:port
npm config set https-proxy http://your-proxy:port
```

### 问题4：白屏但无错误
**症状**：页面空白，控制台无错误

**检查**：
1. CSS文件是否存在：`/public/app-shell.css`
2. 网络标签是否有404错误
3. 是否有JavaScript拦截插件

**解决**：
```cmd
# 检查CSS文件
dir public\app-shell.css

# 如果不存在，需要创建或从备份恢复
```

### 问题5：连接中台失败
**症状**：点击"连接所有"后，HTTP和Socket指示器红色

**检查清单**：
- [ ] 中台服务是否启动（默认端口3100）
- [ ] 中台URL是否正确（检查输入框）
- [ ] 防火墙是否阻止连接
- [ ] CORS是否配置正确

**快速测试**：
```cmd
# 测试中台健康检查
curl http://127.0.0.1:3100/healthz

# 预期返回JSON响应
```

---

## 📋 功能验证清单

### Level 1: 基础验证（无需中台）
- [ ] 页面加载无白屏
- [ ] 控制台无红色错误
- [ ] 依赖库全部加载成功
- [ ] 侧边栏按钮可点击
- [ ] 模态框可打开/关闭
- [ ] 播放控制按钮响应
- [ ] 时间轴可拖动

**测试方法**：
1. 刷新页面
2. 点击每个侧边栏按钮
3. 打开/关闭创建仿真对话框
4. 打开/关闭预案设计对话框
5. 点击快捷分析按钮

### Level 2: 中台集成（需要中台服务）
- [ ] 中台HTTP连接成功
- [ ] Socket.IO连接成功
- [ ] 创建仿真成功
- [ ] 查询仿真信息成功
- [ ] 订阅仿真成功
- [ ] 接收UpdateFrame事件
- [ ] 播放/暂停命令发送成功

**测试方法**：
1. 启动中台服务
2. 点击"连接所有"
3. 观察连接状态指示器
4. 点击"创建仿真"
5. 填写配置并提交
6. 记录返回的simulationId
7. 测试播放控制

### Level 3: UE集成（需要UE运行）
- [ ] Pixel Streaming连接成功
- [ ] 视频流显示正常
- [ ] 摄像机控制响应
- [ ] 数据通道通信正常
- [ ] 帧数据与视频同步

**测试方法**：
1. 启动UE4.26项目（启用Pixel Streaming）
2. 观察Pixel和UE指示器
3. 视频流应显示在播放器区域
4. 测试摄像机控制

---

## 📊 性能基准

### 页面加载时间
- **目标**：< 3秒（首次加载）
- **实测**：待测试

### 依赖库加载时间
- **adapter.js**：~200ms
- **Socket.IO**：~300ms
- **应用脚本**：~100ms

### 帧更新频率
- **目标**：1-2帧/秒（根据中台设置）
- **延迟**：< 500ms

---

## 🎯 接下来做什么

### 场景1：首次使用（验证修复）
```
1. 启动服务器
2. 访问页面
3. 检查控制台
4. 确认无stadium.js错误 ✅
```

### 场景2：开发调试
```
1. 启动中台服务
2. 启动信令服务器
3. 启动UE引擎
4. 在浏览器中测试完整流程
```

### 场景3：生产部署
```
1. 下载所有依赖到本地
2. 配置反向代理（Nginx）
3. 启用HTTPS
4. 配置域名和防火墙
```

---

## 📞 获取帮助

### 日志文件位置
- **信令服务器日志**：`PROJECT\FRONT_UE\frontend\SignallingWebServer\logs\`
- **浏览器控制台**：F12 → Console标签

### 诊断命令
```cmd
# 检查Node.js版本
node --version

# 检查npm版本
npm --version

# 检查端口占用
netstat -ano | findstr :8080
netstat -ano | findstr :3100

# 测试中台连接
curl http://127.0.0.1:3100/healthz
```

### 重置步骤
```cmd
# 1. 停止所有服务
# 按 Ctrl+C 停止node cirrus.js

# 2. 清除npm缓存（可选）
npm cache clean --force

# 3. 重新安装依赖（可选）
cd c:\Users\a\Desktop\双创\PROJECT\FRONT_UE\frontend\SignallingWebServer
rmdir /s /q node_modules
npm install

# 4. 重启服务
node cirrus.js
```

---

## ✅ 验收标准

### 必须满足（P0）
- ✅ 页面可以打开，无白屏
- ✅ 无stadium.js或其他critical错误
- ✅ 所有依赖库正确加载
- ✅ UI交互响应正常

### 应该满足（P1）
- ✅ 可以连接中台服务
- ✅ 可以创建和订阅仿真
- ✅ 可以接收帧更新
- ✅ 播放控制正常工作

### 可以满足（P2）
- ⏳ 可以连接UE Pixel Streaming
- ⏳ 视频流显示正常
- ⏳ 数据可视化功能完整
- ⏳ 性能达到基准

---

**最后更新**：2026-03-31  
**状态**：✅ 核心问题已修复，待运行时验证  
**下一步**：启动服务器进行功能测试
