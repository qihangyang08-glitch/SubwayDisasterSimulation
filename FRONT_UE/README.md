# 前端客户服务程序

## 📖 简介

本模块包含数字孪生地铁灾害应急仿真系统的前端界面和Pixel Streaming客户端。

## 🎉 最新更新（2026-03-31）

✅ **前端重构完成**：修复了stadium.js错误导致的白屏问题
- ✅ 依赖库智能加载策略（支持降级）
- ✅ 固定Socket.IO版本为4.5.4（稳定版）
- ✅ 100%符合DataStruction V1.1规范
- ✅ 完整的错误提示和日志系统

**快速开始**：
```cmd
cd frontend\SignallingWebServer
node cirrus.js
# 访问 http://localhost:8080
```

**详细文档**：
- 📄 [重构总结](REFACTOR_SUMMARY.md) - 修复内容和验收标准
- 🚀 [快速启动](QUICK_START.md) - 启动指南和故障排查
- ✅ [数据结构检查](DATA_STRUCTURE_COMPLIANCE_CHECK.md) - 一致性验证报告

## 📂 目录结构

```
FRONT_UE/
├── frontend/                    # Web前端应用
│   ├── scripts/
│   │   ├── middleware-client.js   # 中台SDK
│   │   ├── app.js                 # 应用主逻辑  
│   │   └── webRtcPlayer.js        # Pixel Streaming播放器
│   ├── modules/
│   │   └── config.js              # 配置管理
│   ├── SignallingWebServer/       # Pixel Streaming信令服务器
│   └── player.html                # 播放器页面
│
└── pixel_streaming_tpl/         # Pixel Streaming模板
```

## 🎨 功能模块

### 1. 中台SDK (middleware-client.js)

封装了与中台服务的HTTP和Socket.IO通信。

#### 初始化
```javascript
const client = new MiddlewareClient({
  httpBaseUrl: 'http://localhost:3000',
  socketUrl: 'http://localhost:3000',
  clientRole: 'frontend'  // 或 'ue'
});
```

#### API调用
```javascript
// 创建仿真
const result = await client.createSimulation({
  scenarioId: 'scenario_001',
  totalPeople: 500,
  disasters: { ... }
});

// 插入帧数据
await client.insertFrames(simulationId, frames);

// 查询帧
const frame = await client.getFrame(simulationId, 5.5);

// 创建计划
const planResult = await client.createPlan(planConfig);

// 应用计划
const applyResult = await client.applyPlan(planId);
```

#### Socket.IO订阅
```javascript
// 订阅仿真
client.subscribe(simulationId);

// 监听事件
client.on('SimState', (data) => {
  console.log('State:', data.payload.state);
  console.log('Time:', data.payload.currentTime);
});

client.on('UpdateFrame', (data) => {
  console.log('Frame:', data.payload.simTime);
  renderFrame(data.payload);
});

// 播放控制
client.play(simulationId);
client.pause(simulationId);
client.seek(simulationId, 10.5);
client.setSpeed(simulationId, 2.0);

// 摄像机控制（发送给UE）
client.sendCameraCommand(simulationId, {
  command: 'rotate',
  angle: 90
});
```

### 2. Pixel Streaming播放器

#### 启动信令服务器
```bash
cd frontend/SignallingWebServer
npm install
node cirrus.js
```

默认端口：80（可在config.json中修改）

#### 连接UE流
```html
<script src="scripts/webRtcPlayer.js"></script>
<script>
  const player = new WebRtcPlayer({
    signallingUrl: 'ws://localhost:80'
  });
  
  player.connect();
  
  player.on('videoReady', () => {
    console.log('Video stream ready');
  });
</script>
```

### 3. 交互界面（待完善）

#### 仿真配置面板
```javascript
// 场景配置
const config = {
  scenarioId: 'metro_fire_001',
  totalPeople: 1000,
  disasters: {
    fire: {
      enabled: true,
      sources: [
        {
          location: { x: 100, y: 200, z: 0 },
          intensity: 0.8,
          startTime: 10.0
        }
      ]
    }
  }
};

// 提交配置
client.createSimulation(config).then(result => {
  console.log('Simulation created:', result.simulationId);
});
```

#### 播放控制器
```javascript
// 播放控制组件（示例）
class PlaybackController {
  constructor(client, simulationId) {
    this.client = client;
    this.simulationId = simulationId;
    this.state = 'paused';
    this.currentTime = 0;
  }
  
  play() {
    this.client.play(this.simulationId);
    this.state = 'playing';
  }
  
  pause() {
    this.client.pause(this.simulationId);
    this.state = 'paused';
  }
  
  seek(time) {
    this.client.seek(this.simulationId, time);
    this.currentTime = time;
  }
  
  setSpeed(speed) {
    this.client.setSpeed(this.simulationId, speed);
  }
}
```

#### 数据可视化（待实现）
```javascript
// ECharts图表示例
const chart = echarts.init(document.getElementById('chart'));

client.on('UpdateFrame', (data) => {
  const agents = data.payload.agents;
  
  // 更新人群密度热力图
  updateHeatmap(agents);
  
  // 更新疏散统计
  updateEvacuationStats(agents);
});

function updateHeatmap(agents) {
  const option = {
    series: [{
      type: 'heatmap',
      data: agents.map(a => [a.position.x, a.position.y, a.panicLevel])
    }]
  };
  chart.setOption(option);
}
```

## 🚀 快速开始

### 1. 安装依赖
```bash
cd frontend
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```

### 3. 访问界面
打开浏览器访问：`http://localhost:8080`

## 🎬 使用流程

### 完整工作流程
```
1. 用户配置仿真参数
   ↓
2. 前端调用中台API创建仿真
   ↓
3. UE引擎运行仿真，生成帧数据
   ↓
4. UE将帧数据发送到中台存储
   ↓
5. 前端订阅Socket.IO
   ↓
6. 用户控制播放（play/pause/seek）
   ↓
7. 中台推送帧数据到前端
   ↓
8. 前端渲染3D画面（Pixel Streaming）和2D图表（ECharts）
```

### 示例代码
```javascript
// 完整示例
async function runSimulation() {
  const client = new MiddlewareClient({
    httpBaseUrl: 'http://localhost:3000',
    socketUrl: 'http://localhost:3000',
    clientRole: 'frontend'
  });
  
  // 1. 创建仿真
  const simResult = await client.createSimulation({
    scenarioId: 'test_001',
    totalPeople: 100,
    disasters: { fire: { enabled: true, sources: [...] } }
  });
  
  const simulationId = simResult.simulationId;
  console.log('Created simulation:', simulationId);
  
  // 2. 订阅
  client.subscribe(simulationId);
  
  // 3. 监听帧更新
  client.on('UpdateFrame', (data) => {
    console.log('Frame:', data.payload.simTime);
    renderScene(data.payload);
  });
  
  // 4. 开始播放
  setTimeout(() => {
    client.play(simulationId);
  }, 1000);
  
  // 5. 10秒后暂停
  setTimeout(() => {
    client.pause(simulationId);
  }, 11000);
}

runSimulation();
```

## 📊 待实现功能

### 高优先级
- [ ] 完整的仿真配置表单
- [ ] 播放控制UI（进度条、速度调节）
- [ ] ECharts数据可视化
- [ ] 响应式布局

### 中优先级
- [ ] 计划编辑器
- [ ] 历史记录查看
- [ ] 导出报告功能

### 低优先级
- [ ] 多语言支持
- [ ] 主题切换
- [ ] 离线模式

## 🎨 UI设计

### 布局结构（建议）
```
┌─────────────────────────────────────┐
│  Header: Logo + 导航                 │
├─────────────────┬───────────────────┤
│                 │                   │
│  Pixel Stream   │   Control Panel   │
│  (3D View)      │   - 播放控制       │
│                 │   - 时间轴         │
│                 │   - 速度调节       │
│                 │                   │
├─────────────────┴───────────────────┤
│  Data Visualization (ECharts)       │
│  - 人群密度热力图                     │
│  - 毒气浓度曲线                       │
│  - 疏散统计表                        │
└─────────────────────────────────────┘
```

### 推荐UI库
- **Ant Design** (React)
- **Element Plus** (Vue 3)
- **Material-UI** (React)

## 🔧 配置说明

### config.json
```json
{
  "middlewareUrl": "http://localhost:3000",
  "signallingUrl": "ws://localhost:80",
  "defaultClientRole": "frontend",
  "playbackSettings": {
    "defaultSpeed": 1.0,
    "speedOptions": [0.5, 1.0, 2.0, 5.0],
    "autoPlay": false
  },
  "visualization": {
    "chartRefreshRate": 100,
    "heatmapResolution": 50
  }
}
```

## 🧪 测试

### 单元测试
```bash
npm test
```

### 端到端测试
```bash
npm run test:e2e
```

### 手动测试
参见 [TEST_GUIDE.md](../TEST_GUIDE.md) 的前端测试部分

## 📝 调试

### 启用调试模式
```javascript
const client = new MiddlewareClient({
  httpBaseUrl: 'http://localhost:3000',
  socketUrl: 'http://localhost:3000',
  debug: true  // 打印详细日志
});
```

### 浏览器控制台
```javascript
// 全局暴露client供调试
window.middlewareClient = client;

// 在控制台测试
middlewareClient.play('sim_xxx');
middlewareClient.pause('sim_xxx');
```

## 🚀 部署

### 构建生产版本
```bash
npm run build
```

### 静态部署
```bash
# 部署到Nginx
cp -r dist/* /var/www/html/

# Nginx配置示例
server {
  listen 80;
  server_name yourdomain.com;
  
  location / {
    root /var/www/html;
    index index.html;
    try_files $uri $uri/ /index.html;
  }
  
  location /api {
    proxy_pass http://localhost:3000;
  }
  
  location /socket.io {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## 📖 相关文档

- [项目总览](../README.md)
- [中台使用指南](../MIDDLEWARE/README.md)
- [测试指南](../TEST_GUIDE.md)
- [数据结构规范](../DOCS/01_DESIGN/DataStruction.md)

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

[许可证类型]
