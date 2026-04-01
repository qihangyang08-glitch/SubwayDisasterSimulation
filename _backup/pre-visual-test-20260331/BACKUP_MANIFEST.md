# 备份清单（可视化测试前整理）
日期: 2026-03-31

已迁移文件：
- MIDDLEWARE/server/scripts/init-db.js
- MIDDLEWARE/server/scripts/check-db.js
- MIDDLEWARE/server/scripts/init-module1-db.js
- MIDDLEWARE/server/scripts/examples.js
- UE_PROJECT/MyProject/WindowsNoEditor/run_pixelstreaming.bat

迁移目的：
- 去除测试链路对快捷脚本的刚性依赖。
- 中台数据库初始化改由服务启动自动完成。
- UE 改为直接运行 exe + 启动参数。

回滚方式：
- 将本目录文件移动回原路径即可。
