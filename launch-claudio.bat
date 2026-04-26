@echo off
chcp 65001 >nul
title Claudio Launcher

echo ==========================================
echo Claudio - Personal AI Radio
echo ==========================================
echo.

REM 检查端口 3000 是否被占用（netease api）
netstat -ano | findstr ":3000" >nul
if %errorlevel% neq 0 (
    echo [1/2] 启动 NeteaseCloudMusicApi (localhost:3000)...
    start "NeteaseAPI" cmd /c "npx netease-cloud-music-api"
    echo 等待 API 启动...
    timeout /t 3 /nobreak >nul
) else (
    echo [1/2] NeteaseCloudMusicApi 已运行
)

echo.
echo [2/2] 启动 Claudio...
echo.

REM 获取当前目录的上一级目录的 src-tauri/target/release/app.exe
set APP_PATH=%~dp0src-tauri\target\release\app.exe

if exist "%APP_PATH%" (
    start "" "%APP_PATH%"
    echo Claudio 已启动！
) else (
    echo 错误：找不到 app.exe
    echo 路径: %APP_PATH%
    pause
)

echo.
echo 按任意键退出此窗口...
pause >nul
