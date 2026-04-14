from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from core.database import close_db, connect_db, settings
from routers import admin, auth, books, courses, exercises, judge, knowledge, progress


class SPAStaticFiles(StaticFiles):
    """Serve index.html for non-file routes so browser routing works in production."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and scope.get("method") == "GET":
                return await super().get_response("index.html", scope)
            raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(title="Python 教学网站 API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(exercises.router)
app.include_router(progress.router)
app.include_router(admin.router)
app.include_router(judge.router)
app.include_router(knowledge.router)
app.include_router(books.router)
app.include_router(ai.router)

# 静态文件服务（书籍文件下载/预览）
uploads_dir = Path(__file__).parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

@app.get("/health")
async def health():
    return {"status": "ok"}


# If a bundled frontend exists, serve it from FastAPI.
frontend_dist = Path(__file__).parent / "frontend_dist"
if frontend_dist.exists():
    app.mount("/", SPAStaticFiles(directory=str(frontend_dist), html=True), name="frontend")

