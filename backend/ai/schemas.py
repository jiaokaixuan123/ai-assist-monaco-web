"""AI 统一请求/响应 Pydantic 模型（路由层用）"""

from pydantic import BaseModel
from typing import List, Optional


# ── 请求模型 ──


class ChatRequestSchema(BaseModel):
    """前端 → 后端 /api/ai/chat 或 /api/ai/stream 的统一请求体"""
    messages: List[dict]          # [{role: "user", content: "..."}, ...]
    temperature: float = 0.7
    max_tokens: int = 800
    model: str = ""               # 空串 = 使用 .env 中默认值


class AskQuestionSchema(BaseModel):
    """知识库 RAG 问答请求（不再含 api_key）"""
    question: str


# ── 响应模型 ──


class ChatResponseSchema(BaseModel):
    """非流式聊天响应"""
    content: str
    model: str


class StreamEventSchema(BaseModel):
    """SSE 事件数据（内部使用）"""
    data: str
    event: Optional[str] = None
