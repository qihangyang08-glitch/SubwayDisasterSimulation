# 快速开始 - 数据库自检与初始化

## ⚡ 5分钟快速启动

### 步骤1: 确保MySQL已安装并运行

**Windows**:
```powershell
# 检查MySQL服务状态
Get-Service MySQL80

# 如果未运行，启动MySQL服务
Start-Service MySQL80
```

**Linux/Mac**:
```bash
# 检查MySQL服务状态
systemctl status mysql

# 如果未运行，启动MySQL服务
sudo systemctl start mysql
```

### 步骤2: 配置数据库连接

1. 进入项目目录:
   ```bash
   cd PROJECT/MIDDLEWARE/server
   ```

2. 复制配置文件:
   ```bash
   # Windows PowerShell
   Copy-Item .env.example .env
   
   # Linux/Mac
   cp .env.example .env
   ```

3. 编辑 `.env` 文件，修改数据库密码:
   ```bash
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=你的MySQL密码
   DB_NAME=metro_sim
   ```

### 步骤3: 安装依赖（如果还没有）

```bash
npm install
```

### 步骤4: 启动服务（自动初始化数据库）

```bash
npm start
```

**预期输出**:
```
[Server] Initializing database...
[DBInitializer] ========== Database Initialization Started ==========
[DBInitializer] Target database: metro_sim
[DBInitializer] Database 'metro_sim' does not exist
[DBInitializer] Creating database: metro_sim
[DBInitializer] Database created successfully: metro_sim
[DBInitializer] Creating tables...
[DBInitializer] All tables created successfully
[DBInitializer] Table structure validation passed
[DBInitializer] ========== Database Initialization Completed Successfully ==========
[Server] Database ready

╔════════════════════════════════════════════════════════════╗
║  Metro Simulation Middleware Server                       ║
╚════════════════════════════════════════════════════════════╝

  HTTP API:    http://0.0.0.0:3000
  Socket.IO:   ws://0.0.0.0:3000
  Version:     1.0

  Database Status:
    ✅ Database created
    ✅ Tables created

  Server is ready to accept connections
```

✅ **完成！** 数据库已自动创建并初始化，服务正在运行。

---

## 🔧 常见问题

### 问题1: 无法连接到MySQL

**错误提示**:
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**解决方案**:
1. 确认MySQL服务已启动
2. 检查 `.env` 中的 `DB_HOST` 和 `DB_PORT` 配置
3. 检查防火墙设置

### 问题2: 权限不足

**错误提示**:
```
Error: Access denied for user 'root'@'localhost'
```

**解决方案**:
1. 检查 `.env` 中的 `DB_USER` 和 `DB_PASSWORD` 是否正确
2. 确认用户有创建数据库的权限

授予权限（在MySQL命令行中执行）:
```sql
mysql -u root -p
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 问题3: 端口已被占用

**错误提示**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方案**:
修改 `.env` 文件中的端口:
```bash
PORT=3001
```

---

## 📋 验证安装

### 方法1: 检查数据库状态

```bash
npm run db:check
```

### 方法2: 测试API

```bash
# Windows PowerShell
Invoke-WebRequest -Uri http://localhost:3000/api/simulations -Method GET

# Linux/Mac
curl http://localhost:3000/api/simulations
```

### 方法3: 在MySQL中检查

```sql
mysql -u root -p

USE metro_sim;
SHOW TABLES;

-- 应该看到4张表:
-- simulations
-- simulation_frames
-- plans
-- plan_runs
```

---

## 🎯 下一步

现在数据库已经就绪，你可以:

1. **测试API接口** - 查看 `PROJECT/MIDDLEWARE/README.md`
2. **运行测试** - `npm test`
3. **查看详细文档** - `db/README_DB_INIT.md`

---

## 🆘 需要帮助？

- **详细文档**: `db/README_DB_INIT.md`
- **实施总结**: `db/IMPLEMENTATION_SUMMARY.md`
- **主README**: `PROJECT/MIDDLEWARE/README.md`
- **数据结构**: `DataStruction.md`

---

**祝你使用愉快！** 🎉
