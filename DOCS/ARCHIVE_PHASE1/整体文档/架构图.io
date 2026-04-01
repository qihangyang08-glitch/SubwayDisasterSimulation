graph TD
    %% 定义样式类
    classDef web fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef mid fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    classDef ue fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef back fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef db fill:#eceff1,stroke:#455a64,stroke-width:2px
    
    %% ================= 1. 前端客户服务程序 =================
    subgraph Client_Layer["前端客户服务层 Web Client"]
        Web_UI["Web 交互界面<br/>Vue/React<br/>━━━━━━━━━━<br/>参数配置表单<br/>进度条/时间轴<br/>数据图表 ECharts"]
        Video_Player["Pixel Streaming 播放器<br/>━━━━━━━━━━<br/>视频流解码<br/>键鼠事件捕获"]
    end
    
    %% ================= 2. 控制与数据中台 =================
    subgraph Middleware_Layer["控制与数据中台 Control Middleware"]
        Controller["中控服务<br/>Node.js/Python<br/>━━━━━━━━━━<br/>状态机管理<br/>进度调度器<br/>信令服务 Signaling"]
        DB[("仿真数据库<br/>MySQL/MongoDB<br/>━━━━━━━━━━<br/>存储全量历史帧")]
    end
    
    %% ================= 3. UE 画面绘制程序 =================
    subgraph Render_Layer["UE 画面绘制层"]
        UE4_App["UE4 客户端<br/>后台运行<br/>━━━━━━━━━━<br/>场景渲染<br/>动画状态机更新<br/>摄像机漫游逻辑"]
        Plugin_PS["Pixel Streaming 插件<br/>━━━━━━━━━━<br/>视频编码 H.264<br/>输入指令映射"]
    end
    
    %% ================= 4. 后端仿真与决策 =================
    subgraph Backend_Layer["后端计算与决策层"]
        Sim_Engine["仿真计算引擎<br/>Python/Node.js<br/>━━━━━━━━━━<br/>流体/烟雾计算<br/>人群 Agent 行为"]
        LLM_Service["大模型服务 API<br/>━━━━━━━━━━<br/>生成应急预案<br/>文本解析"]
    end
    
    %% ================= 连线关系 =================
    %% A. 配置与计算阶段
    Web_UI -->|"❶ HTTP<br/>提交仿真参数"| Controller
    Controller -->|"❷ 触发计算任务"| Sim_Engine
    Sim_Engine -->|"❸ 高频写入<br/>全量数据帧"| Controller
    Controller -->|"❹ 序列化存储"| DB
    
    %% B. 决策辅助阶段
    Web_UI -.->|"请求预案"| Controller
    Controller -.->|"提取特征数据"| LLM_Service
    LLM_Service -.->|"返回决策JSON"| Controller
    
    %% C. 回放与渲染阶段
    Web_UI -->|"❺ WebSocket<br/>拖动进度条/播放"| Controller
    Controller -->|"❻ 检索特定<br/>时间帧"| DB
    DB -->|"❼ 返回帧数据<br/>JSON"| Controller
    Controller -->|"❽ WebSocket<br/>推送当前帧状态"| UE4_App
    
    %% D. 视觉与操作反馈
    UE4_App -->|"❾ 内部解析<br/>更新Mesh位置/材质"| Plugin_PS
    Plugin_PS ==>|"❿ WebRTC<br/>实时视频流 P2P"| Video_Player
    Video_Player -.->|"⓫ DataChannel<br/>摄像机控制 WASD"| Plugin_PS
    
    %% 应用样式
    class Web_UI,Video_Player web
    class Controller mid
    class DB db
    class UE4_App,Plugin_PS ue
    class Sim_Engine,LLM_Service back