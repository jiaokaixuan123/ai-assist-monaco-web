@echo off
setlocal

cd /d "%~dp0\backend"

if not exist ".venv\Scripts\python.exe" (
  echo backend\.venv is missing. Run install-backend-deps.bat first.
  exit /b 1
)

if not exist ".env" (
  if exist "%~dp0\.env.backend.example" (
    copy "%~dp0\.env.backend.example" ".env" >nul
    echo Created backend\.env from template. Update SECRET_KEY before production use.
  )
)

if "%HOST%"=="" set HOST=0.0.0.0
if "%PORT%"=="" set PORT=8000

call .venv\Scripts\activate.bat
python -m uvicorn main:app --host %HOST% --port %PORT%

