# Windows Deployment Guide

This project can be deployed on a Windows server as a single FastAPI service:
- Backend API (`/api/*`)
- Static files for uploaded books (`/uploads/*`)
- Frontend build output (served by FastAPI from `backend/frontend_dist`)

## 1) Build and package on your development machine

From repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-windows.ps1
```

If you also want MongoDB data dump in the package:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-windows.ps1 -IncludeMongoDump -MongoUri "mongodb://localhost:27017" -MongoDatabase "python_edu"
```

Output:
- `release\monaco-ai-assist-web-win-<timestamp>.zip`

## 2) Copy package to Windows server

1. Copy the generated `.zip` to server.
2. Extract it to a directory, for example `D:\apps\monaco-ai-assist-web`.

After extraction, key files:
- `backend\` (backend code + uploads + chroma_db + frontend_dist)
- `install-backend-deps.bat`
- `start-server.bat`
- `restore-mongo.bat` (only used when `mongo_dump` exists)
- `.env.backend.example`

## 3) Install backend dependencies

Run in an elevated command prompt (or normal user with Python installed):

```bat
install-backend-deps.bat
```

This script:
- requires Python 3.11
- creates `backend\.venv`
- installs core dependencies from `backend\requirements.txt`

If you need RAG features (`/api/knowledge`, book indexing), install optional deps:

```bat
set WITH_RAG=1
install-backend-deps.bat
```

If your server has slow/blocked access to PyPI, set mirror first:

```bat
set PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
install-backend-deps.bat
```

## 4) Configure backend environment

Create `backend\.env` from template:

```bat
copy .env.backend.example backend\.env
```

Then edit `backend\.env` and set at least:
- `MONGODB_URL`
- `DB_NAME`
- `SECRET_KEY` (must be changed for production)
- `CORS_ORIGINS` (only needed for cross-origin setups)

## 5) (Optional) Restore MongoDB data

If package contains `mongo_dump\` and server has `mongorestore`:

```bat
restore-mongo.bat
```

Or set custom env vars before restore:

```bat
set MONGO_URI=mongodb://127.0.0.1:27017
set MONGO_DB=python_edu
restore-mongo.bat
```

## 6) Start service

```bat
start-server.bat
```

Default listen address:
- `HOST=0.0.0.0`
- `PORT=8000`

You can override before startup:

```bat
set HOST=0.0.0.0
set PORT=8080
start-server.bat
```

## 7) Verify

- Health check: `http://<server-ip>:<port>/health`
- API docs: `http://<server-ip>:<port>/docs`
- Frontend: `http://<server-ip>:<port>/`

## Notes

- Frontend requests default to same-origin in production build.
- Uploaded files and vector index are included in `backend\uploads` and `backend\chroma_db`.
- MongoDB data is not file-copied automatically unless `-IncludeMongoDump` is used.

