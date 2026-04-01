# Module 2 运行手册

## 1) 安装依赖
1. 进入 PROJECT/MIDDLEWARE/server
2. 运行 npm install

## 2) 启动 HTTP 服务
- 命令：npm start
- 默认地址：http://0.0.0.0:3000

## 3) 环境变量
- PORT：监听端口（默认 3000）
- HOST：监听地址（默认 0.0.0.0）
- API_VERSION：Envelope.version（默认 1.0）
- CORS_ENABLED：是否开启 CORS（1 开启，0 关闭）
- CORS_ORIGIN：允许跨域来源（默认 *）
- AUTH_ENABLED：是否开启 Token 鉴权（1 开启，0 关闭）
- AUTH_TOKEN：Bearer Token 值
- DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME：数据库连接配置

## 4) 请求幂等
- 幂等键：method + originalUrl + requestId
- requestId 来源优先级：
  1) x-request-id 头
  2) query.requestId
  3) body.requestId
  4) 服务端自动生成
- 命中幂等缓存时返回头：x-idempotent-replay: 1

## 5) 兼容路由弃用策略
- 别名路由继续可用，但响应带 Deprecation 相关头。
- 客户端应逐步迁移到 /api/simulations 与 /api/plans 主版本。

## 6) 快速自检
- 健康检查：GET /healthz
- 创建仿真：POST /api/simulations
- 注入帧：POST /api/simulations/:simId/frames
- 查询时间范围：GET /api/simulations/:simId/info
- 查询时间点帧：GET /api/simulations/:simId/frame?time=12.5
- 创建方案：POST /api/plans
- 应用方案：POST /api/plans/:planId/apply

## 7) 失败与回滚策略
- 参数错误：直接返回 400 + Error Envelope。
- 资源不存在：返回 404 + Error Envelope。
- DAL/内部失败：返回 500 + Error Envelope，并写入内存重试队列（retryQueue）。