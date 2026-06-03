@echo off
setlocal EnableExtensions

if /i not "%~1"=="run" (
  cd /d "%~dp0"
  cmd /k call "%~f0" run
  exit /b 0
)

cd /d "%~dp0"
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%LOCALAPPDATA%\Programs\node;%PATH%"

echo.
echo === LK-uchet ===
echo %CD%
echo.

where node >nul 2>&1 || (echo [ERROR] Node.js not found & goto end)
where npm >nul 2>&1 || (echo [ERROR] npm not found & goto end)

if not exist ".env" copy /Y ".env.example" ".env" >nul
if not exist "node_modules\" (
  echo npm install...
  call npm install || (echo [ERROR] npm install failed & goto end)
)

echo Free ports...
call node scripts/free-ports.mjs
ping 127.0.0.1 -n 2 >nul

echo.
echo Starting... Open: http://127.0.0.1:5173
echo Login: admin  Password: from .env
echo Do NOT run start.bat twice. Ctrl+C to stop.
echo.

start "" cmd /c "ping 127.0.0.1 -n 8 >nul && start http://127.0.0.1:5173"

call npm run dev

:end
echo.
echo Exit code: %ERRORLEVEL%
echo.
