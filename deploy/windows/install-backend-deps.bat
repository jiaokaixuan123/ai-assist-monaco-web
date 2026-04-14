@echo off
setlocal

cd /d "%~dp0\backend"

set "PY_CMD=py -3.11"
py -3.11 --version >nul 2>&1
if errorlevel 1 (
  set "PY_CMD=python"
  python --version >nul 2>&1
  if errorlevel 1 (
    echo Python was not found. Install Python first, then rerun install-backend-deps.bat.
    exit /b 1
  )
  echo Python 3.11 not found. Falling back to default python in PATH.
  echo For best compatibility on Windows server, Python 3.11 is still recommended.
)

if not exist ".venv\Scripts\python.exe" (
  echo Creating virtual environment...
  %PY_CMD% -m venv .venv
  if errorlevel 1 (
    echo Failed to create virtual environment.
    exit /b 1
  )
)

call .venv\Scripts\activate.bat

set "PIP_COMMON=--prefer-binary --timeout 180 --retries 5"
python -m pip install %PIP_COMMON% --upgrade pip setuptools wheel
if errorlevel 1 exit /b 1

echo Installing backend core dependencies...
pip install %PIP_COMMON% -r requirements.txt
if errorlevel 1 exit /b 1

if /I "%WITH_RAG%"=="1" (
  echo Installing optional RAG dependencies...
  pip install %PIP_COMMON% -r requirements-rag.txt
  if errorlevel 1 (
    echo Optional RAG dependencies failed to install.
    echo You can still run core features without RAG.
    exit /b 1
  )
) else (
  echo Skipping optional RAG dependencies. Set WITH_RAG=1 to install them.
)

echo Backend dependencies installed successfully.
exit /b 0

