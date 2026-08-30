@echo off
rem 科技坦克大战 · 本地预览启动脚本
rem 优先使用 Node（server.js），没有则回退到 Python 内置 http.server
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel%==0 (
    echo [TankBattle] 检测到 Node，启动静态服务...
    node server.js
    goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
    echo [TankBattle] 检测到 Python(py)，启动 http.server...
    py -m http.server 8000
    goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
    echo [TankBattle] 检测到 Python，启动 http.server...
    python -m http.server 8000
    goto :eof
)

echo [TankBattle] 未检测到 Node 或 Python，请安装其一后重试。
pause