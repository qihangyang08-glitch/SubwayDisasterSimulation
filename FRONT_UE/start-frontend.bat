@echo off
REM ============================================
REM 前端服务器启动脚本
REM 数字孪生地铁灾害应急仿真系统
REM ============================================

echo.
echo ========================================
echo   前端服务器启动中...
echo ========================================
echo.

cd /d "%~dp0frontend\SignallingWebServer"

REM 检查Node.js是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [检查] Node.js版本:
node --version
echo.

REM 检查node_modules
if not exist "node_modules" (
    echo [警告] 未检测到node_modules目录
    echo [提示] 如需完整功能，请先运行: npm install
    echo.
)

REM 启动服务器
echo [启动] 正在启动Cirrus信令服务器...
echo [地址] http://localhost:8080
echo [日志] 详细日志将保存到 logs/ 目录
echo.
echo ========================================
echo   按 Ctrl+C 可停止服务器
echo ========================================
echo.

node cirrus.js

pause
