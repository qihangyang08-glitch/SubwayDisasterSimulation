# 数据库自检与初始化 - 完整文档索引

## 📖 文档导航

根据你的需求选择合适的文档:

### 🚀 我想快速开始
👉 [快速开始指南](./QUICK_START.md)  
5分钟内完成数据库配置和服务启动

### 📚 我想了解详细功能
👉 [功能详细文档](./README_DB_INIT.md)  
完整的功能说明、API文档、使用示例和最佳实践

### 📋 我想了解实现细节
👉 [实施总结](./IMPLEMENTATION_SUMMARY.md)  
技术实现、代码结构、功能特性和技术亮点

### 📰 我想了解更新内容
👉 [更新日志](./CHANGELOG.md)  
新增文件、修改内容、升级步骤和注意事项

---

## ⚡ 核心功能

### 自动化数据库初始化
- ✅ 检查数据库是否存在
- ✅ 自动创建数据库（如不存在）
- ✅ 检查表是否存在
- ✅ 自动创建表（如不存在）
- ✅ 验证表结构完整性
- ✅ 详细的日志输出

### 三种使用方式

#### 1. 自动初始化（推荐）
```bash
npm start
```
服务启动时自动检查和初始化数据库

#### 2. 手动初始化
```bash
npm run db:init
```
独立执行数据库初始化，不启动服务

#### 3. 状态检查
```bash
npm run db:check
```
只检查数据库状态，不做任何修改

---

## 📁 文件结构

```
PROJECT/MIDDLEWARE/
├── db/
│   ├── sql/
│   │   └── module1_schema.sql          # 数据库表结构SQL
│   ├── README_DB_INIT.md               # 详细功能文档
│   ├── IMPLEMENTATION_SUMMARY.md       # 实施总结
│   ├── QUICK_START.md                  # 快速开始指南
│   ├── CHANGELOG.md                    # 更新日志
│   └── INDEX.md                        # 本文档
│
└── server/
    ├── src/
    │   └── db/
    │       ├── mysqlPool.js            # 数据库连接池
    │       ├── transaction.js          # 事务封装
    │       └── dbInitializer.js        # 数据库初始化器 (新增)
    │
    ├── scripts/
    │   ├── init-db.js                  # 初始化脚本 (新增)
    │   └── check-db.js                 # 状态检查脚本 (新增)
    │
    ├── tests/
    │   └── dbInitializer.test.js       # 单元测试 (新增)
    │
    ├── .env.example                    # 配置示例 (新增)
    └── package.json                    # 脚本已更新
```

---

## 🎯 快速参考

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm start` | 启动服务（自动初始化数据库） |
| `npm run db:init` | 手动初始化数据库 |
| `npm run db:check` | 检查数据库状态 |
| `npm test` | 运行测试 |

### 配置文件

**位置**: `PROJECT/MIDDLEWARE/server/.env`

**必需配置**:
```bash
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密码
DB_NAME=metro_sim
```

### 数据库表

| 表名 | 说明 |
|------|------|
| simulations | 仿真配置信息 |
| simulation_frames | 仿真帧数据 |
| plans | 应急计划 |
| plan_runs | 计划执行记录 |

---

## 🔍 故障排查

### 常见问题

| 问题 | 解决方案 | 详细说明 |
|------|---------|---------|
| 无法连接MySQL | 检查MySQL服务和配置 | [快速开始](./QUICK_START.md#问题1-无法连接到mysql) |
| 权限不足 | 授予数据库权限 | [快速开始](./QUICK_START.md#问题2-权限不足) |
| 端口占用 | 修改PORT配置 | [快速开始](./QUICK_START.md#问题3-端口已被占用) |
| 表结构验证失败 | 重新创建表 | [详细文档](./README_DB_INIT.md#错误处理) |

---

## 📊 技术栈

- **数据库**: MySQL 8.0+
- **Node.js**: 建议 v16+
- **依赖库**: mysql2, express, socket.io

---

## 🎓 学习路径

### 新手用户
1. 阅读 [快速开始](./QUICK_START.md)
2. 配置环境变量
3. 运行 `npm start`
4. 验证安装

### 开发人员
1. 阅读 [实施总结](./IMPLEMENTATION_SUMMARY.md)
2. 查看 [详细文档](./README_DB_INIT.md)
3. 研究 `dbInitializer.js` 源码
4. 运行测试 `npm test`

### 运维人员
1. 阅读 [更新日志](./CHANGELOG.md)
2. 查看升级步骤
3. 使用 `npm run db:check` 检查状态
4. 阅读错误处理部分

---

## ✨ 功能亮点

1. **零配置** - 首次启动自动创建所有资源
2. **幂等性** - 可重复执行，安全无副作用
3. **智能化** - 自动检测缺失的资源
4. **可观察** - 详细的日志和状态反馈
5. **易调试** - 清晰的错误信息和解决建议
6. **高可用** - 完善的错误处理和恢复机制

---

## 🤝 贡献指南

发现问题或有改进建议？

1. 查看相关文档寻找答案
2. 运行 `npm run db:check` 诊断问题
3. 查看日志输出
4. 联系开发团队

---

## 📞 获取帮助

- **功能问题**: 查看 [详细文档](./README_DB_INIT.md)
- **使用问题**: 查看 [快速开始](./QUICK_START.md)
- **技术问题**: 查看 [实施总结](./IMPLEMENTATION_SUMMARY.md)
- **更新问题**: 查看 [更新日志](./CHANGELOG.md)

---

**祝你使用愉快！** 🎉

最后更新: 2026-03-30
