@echo off
setlocal

cd /d "%~dp0"

if "%PYRIGHT_WS_PORT%"=="" set PYRIGHT_WS_PORT=3001

echo Starting Pyright LSP WebSocket server on port %PYRIGHT_WS_PORT%...
npm run lsp:server
