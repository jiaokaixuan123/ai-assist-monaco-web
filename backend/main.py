from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path
from core.database import connect_db, close_db
from routers import auth, courses, exercises, progress, admin, judge, knowledge, books, ai


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


@app.get("/")
async def root():
    return {"message": "Python 教学网站 API 运行中"}
