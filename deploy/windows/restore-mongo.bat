@echo off
setlocal

set "DUMP_DIR=%~dp0mongo_dump"
if not "%~1"=="" set "DUMP_DIR=%~1"

if "%MONGO_URI%"=="" set "MONGO_URI=mongodb://localhost:27017"
if "%MONGO_DB%"=="" set "MONGO_DB=python_edu"

where mongorestore >nul 2>&1
if errorlevel 1 (
  echo mongorestore not found. Install MongoDB Database Tools first.
  exit /b 1
)

if not exist "%DUMP_DIR%\%MONGO_DB%" (
  echo Mongo dump directory not found: "%DUMP_DIR%\%MONGO_DB%"
  exit /b 1
)

mongorestore --uri "%MONGO_URI%" --drop --db "%MONGO_DB%" "%DUMP_DIR%\%MONGO_DB%"
if errorlevel 1 (
  echo MongoDB restore failed.
  exit /b 1
)

echo MongoDB restore completed.
exit /b 0

