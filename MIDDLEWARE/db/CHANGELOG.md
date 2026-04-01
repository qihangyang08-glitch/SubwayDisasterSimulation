# 数据库自检与初始化功能 - 更新说明

## 📅 更新日期
2026-03-30

## 🎯 更新目标
为"数字孪生地铁灾害应急仿真"项目添加数据库自检与初始化功能，实现系统启动时自动检查数据库状态，如果数据库或表不存在则自动创建和初始化。

## 📦 新增文件清单

### 核心功能模块
```
PROJECT/MIDDLEWARE/server/src/db/
└── dbInitializer.js              (核心数据库初始化模块)
```

### 脚本工具
```
PROJECT/MIDDLEWARE/server/scripts/
├── init-db.js                    (手动初始化脚本)
└── check-db.js                   (数据库状态检查脚本)
```

### 测试文件
```
PROJECT/MIDDLEWARE/server/tests/
└── dbInitializer.test.js         (单元测试)
```

### 文档
```
PROJECT/MIDDLEWARE/db/
├── README_DB_INIT.md             (详细功能文档)
├── IMPLEMENTATION_SUMMARY.md     (实施总结)
├── QUICK_START.md                (快速开始指南)
└── CHANGELOG.md                  (本文件)
```

### 配置文件
```
PROJECT/MIDDLEWARE/server/
└── .env.example                  (环境变量配置示例)
```

## ✏️ 修改的文件

### 1. server.js
**文件**: `PROJECT/MIDDLEWARE/server/src/http/server.js`

**主要改动**:
- 引入 `dbInitializer` 模块
- 添加 `startServer()` 异步函数
- 在服务启动前调用 `initializeDatabase()`
- 增强启动日志输出
- 添加优雅关闭处理（SIGTERM, SIGINT）

**影响**:
- ✅ 向后兼容，不影响现有功能
- ✅ 提升启动体验，显示数据库状态
- ✅ 增加错误处理，初始化失败时阻止启动

### 2. package.json
**文件**: `PROJECT/MIDDLEWARE/server/package.json`

**新增脚本**:
```json
{
  "scripts": {
    "db:init": "node scripts/init-db.js",
    "db:check": "node scripts/check-db.js"
  }
}
```

**影响**:
- ✅ 向后兼容
- ✅ 新增两个便捷命令

## 🔧 功能说明

### 自动初始化流程

1. **服务启动时自动执行**
   - 连接MySQL服务器
   - 检查目标数据库是否存在
   - 如不存在，创建数据库
   - 检查所有必需的表
   - 如有缺失，执行SQL脚本创建表
   - 验证表结构完整性

2. **幂等性保证**
   - 可重复执行，不会破坏现有数据
   - 智能检测已存在的资源
   - 只创建缺失的数据库和表

3. **详细日志**
   - 每个步骤都有清晰的日志输出
   - 成功/失败状态明确标识
   - 错误时提供解决建议

### 使用方式

#### 方式1: 自动（推荐）
```bash
npm start
```
服务启动时自动初始化数据库

#### 方式2: 手动初始化
```bash
npm run db:init
```

#### 方式3: 状态检查
```bash
npm run db:check
```

## 📊 数据库结构

系统会自动创建以下表（遵循DataStruction.md规范）:

| 表名 | 说明 | 主键 |
|------|------|------|
| simulations | 仿真配置 | sim_id |
| simulation_frames | 仿真帧数据 | (sim_id, frame_index) |
| plans | 应急计划 | plan_id |
| plan_runs | 计划执行记录 | plan_run_id |

## 🔐 环境变量配置

新增配置项（所有配置项都有默认值）:

```bash
# 数据库配置
DB_HOST=localhost              # MySQL服务器地址
DB_PORT=3306                   # MySQL端口
DB_USER=root                   # 数据库用户名
DB_PASSWORD=                   # 数据库密码
DB_NAME=metro_sim             # 数据库名称

# 连接池配置（可选）
DB_CONNECTION_LIMIT=16        # 最大连接数
DB_QUEUE_LIMIT=0              # 队列限制
DB_CONNECT_TIMEOUT_MS=10000   # 连接超时
```

## 🧪 测试

新增测试文件: `tests/dbInitializer.test.js`

**测试覆盖**:
- ✅ 数据库连接测试
- ✅ 数据库存在性检查
- ✅ 表存在性检查
- ✅ 表结构验证
- ✅ 完整初始化流程
- ✅ 幂等性验证

**运行测试**:
```bash
npm test
```

## ⚠️ 注意事项

1. **向后兼容性**: ✅ 完全兼容现有代码，不影响已有功能

2. **数据安全**: 
   - ✅ 不修改已存在的表结构
   - ✅ 不删除或覆盖现有数据
   - ✅ 只添加缺失的资源

3. **权限要求**: 
   - 数据库用户需要有创建数据库和表的权限
   - 如权限不足，会提供明确的错误提示

4. **MySQL版本**: 
   - 建议使用MySQL 8.0+
   - 兼容MySQL 5.7+

## 🚀 升级步骤

对于已有项目，按以下步骤升级:

### 步骤1: 更新代码
```bash
# 拉取最新代码（或手动复制新文件）
git pull
```

### 步骤2: 配置环境变量
```bash
# 复制配置示例
cp .env.example .env

# 编辑.env，填写数据库配置
# 特别是DB_PASSWORD字段
```

### 步骤3: 测试初始化
```bash
# 检查当前数据库状态
npm run db:check

# 如需初始化，执行
npm run db:init
```

### 步骤4: 启动服务
```bash
npm start
```

## 📚 文档索引

| 文档 | 说明 | 位置 |
|------|------|------|
| 快速开始 | 5分钟快速启动指南 | `db/QUICK_START.md` |
| 详细文档 | 完整功能说明和API | `db/README_DB_INIT.md` |
| 实施总结 | 技术实现和代码结构 | `db/IMPLEMENTATION_SUMMARY.md` |
| 更新日志 | 本文档 | `db/CHANGELOG.md` |

## 🎁 功能亮点

1. **零配置启动** - 首次启动自动创建所有必需的资源
2. **智能检测** - 准确识别缺失的数据库和表
3. **详细日志** - 清晰的执行过程和状态反馈
4. **错误友好** - 提供具体的错误信息和解决建议
5. **幂等安全** - 可重复执行，不影响现有数据
6. **灵活使用** - 支持自动、手动、检查三种模式

## 🔄 未来优化方向

1. **数据库迁移** - 添加版本管理和迁移工具
2. **健康检查** - 定期检查数据库连接和表状态
3. **备份恢复** - 集成自动备份功能
4. **性能监控** - 添加数据库性能监控
5. **多数据库支持** - 支持PostgreSQL等其他数据库

## 💡 反馈与建议

如遇到问题或有改进建议，请:
1. 查看详细文档 `db/README_DB_INIT.md`
2. 运行 `npm run db:check` 检查状态
3. 查看日志输出定位问题
4. 联系开发团队

---

**更新完成，功能已可用！** 🎉
