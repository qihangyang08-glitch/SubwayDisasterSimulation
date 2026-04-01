@echo off
setlocal

rem Adjust IP/port if your SignallingWebServer runs elsewhere
set PIXEL_STREAMING_IP=127.0.0.1
set PIXEL_STREAMING_PORT=8888

set EXE_PATH=%~dp0ueProj.exe

start "ueProj" "%EXE_PATH%" -PixelStreamingIP=%PIXEL_STREAMING_IP% -PixelStreamingPort=%PIXEL_STREAMING_PORT% -RenderOffScreen -AudioMixer

echo Started: %EXE_PATH%
endlocal
