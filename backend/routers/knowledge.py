from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

# 惰性初始化（避免启动时崩溃）
_model = None
_collection = None

MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
_HF_CACHE_SUBDIR = "models--sentence-transformers--paraphrase-multilingual-MiniLM-L12-v2"


def _find_local_model_path() -> str | None:
    """返回本地 HuggingFace 缓存中最新快照路径，找不到返回 None"""
    try:
        from huggingface_hub import constants
        cache_root = Path(constants.HF_HUB_CACHE)
    except Exception:
        cache_root = Path.home() / ".cache" / "huggingface" / "hub"

    snaps_dir = cache_root / _HF_CACHE_SUBDIR / "snapshots"
    if not snaps_dir.exists():
        return None
    snaps = sorted(snaps_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
    for snap in snaps:
        if (snap / "config.json").exists():
            return str(snap)
    return None


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        local_path = _find_local_model_path()
        if local_path:
            # 直接加载本地快照，完全不联网
            _model = SentenceTransformer(local_path)
        else:
            _model = SentenceTransformer(MODEL_NAME)
    return _model


def get_collection():
    global _collection
    if _collection is None:
        import chromadb
        chroma_client = chromadb.PersistentClient(path="./chroma_db")
        try:
            _collection = chroma_client.get_or_create_collection("course_knowledge")
        except Exception as e:
            raise HTTPException(500, f"知识库初始化失败: {e}")
    return _collection


def _format_source(meta: dict) -> str:
    """统一格式化来源标签（兼容书籍和课程两种 metadata）"""
    if meta.get("source_type") == "book":
        author = f"·{meta['author']}" if meta.get("author") else ""
        return f"📖 {meta.get('book_title', '书籍')}{author}"
    # 兼容旧版课程 metadata
    return f"📚 {meta.get('lesson_title', meta.get('book_title', '课程内容'))}"


class SearchRequest(BaseModel):
    query: str
    top_k: int = 3


@router.post("/search")
async def search_knowledge(req: SearchRequest):
    """向量检索，返回最相关的知识片段"""
    model = get_model()
    collection = get_collection()

    # 集合为空时直接返回
    if collection.count() == 0:
        return {"query": req.query, "results": []}

    query_embedding = model.encode([req.query])[0].tolist()
    n = min(req.top_k, collection.count())
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n,
    )

    return {
        "query": req.query,
        "results": [
            {
                "content": doc,
                "metadata": meta,
                "source": _format_source(meta),
                "distance": dist,
            }
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            )
        ],
    }


class AskRequest(BaseModel):
    """RAG 问答请求（不再包含 api_key，密钥由后端 .env 统一管理）"""
    question: str


@router.post("/ask")
async def ask_with_context(req: AskRequest):
    """RAG 问答：检索相关片段 → 构建 prompt → 通过 AI 模块调用大模型"""
    from ai import is_ai_available, get_provider, ChatOptions, ChatMessage

    if not is_ai_available():
        raise HTTPException(
            503, "AI 服务未配置，请在 backend/.env 中设置 AI_API_KEY"
        )

    model = get_model()
    collection = get_collection()

    if collection.count() == 0:
        raise HTTPException(400, "知识库为空，请先在管理后台对书籍建立索引")

    # 1. 检索相关内容
    query_embedding = model.encode([req.question])[0].tolist()
    n = min(3, collection.count())
    results = collection.query(query_embeddings=[query_embedding], n_results=n)

    docs = results["documents"][0]
    metas = results["metadatas"][0]

    # 2. 构建上下文，标注来源
    context_parts = []
    for doc, meta in zip(docs, metas):
        source = _format_source(meta)
        context_parts.append(f"[来源：{source}]\n{doc}")
    context = "\n\n---\n\n".join(context_parts)

    # 3. 构建 prompt
    prompt = f"""你是一个专业的 Python 编程助教。请基于以下教材内容回答学生的问题。
回答要求：
- 优先引用教材中的内容和例子
- 语言简洁易懂，适当给出可运行的代码示例
- 如果教材内容不足以回答，可以补充自己的知识，但要注明

【参考教材内容】
{context}

【学生问题】
{req.question}"""

    # 4. 通过统一 AI 模块调用大模型（不再使用 openai 库 + 前端传 key）
    try:
        provider = get_provider()
        response = await provider.chat(ChatOptions(
            messages=[ChatMessage(role="user", content=prompt)],
            temperature=0.4,
        ))
        answer = response.content
    except Exception as e:
        raise HTTPException(500, f"调用模型失败: {str(e)}")

    return {
        "answer": answer,
        "sources": [_format_source(m) for m in metas],
    }


@router.get("/stats")
async def knowledge_stats():
    """返回知识库统计信息"""
    try:
        collection = get_collection()
        count = collection.count()
        return {"total_chunks": count, "status": "ready" if count > 0 else "empty"}
    except Exception:
        return {"total_chunks": 0, "status": "uninitialized"}
