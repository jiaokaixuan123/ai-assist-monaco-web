"""AI 统一代理路由 — 前端所有 AI 请求经此后端转发至实际模型服务"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import json
import logging

from ai import (
    get_provider,
    is_ai_available,
    get_ai_config,
    ChatRequestSchema,
    ChatResponseSchema,
    ChatMessage,
    ChatOptions,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])


# ── 状态查询 ──


@router.get("/status")
async def ai_status():
    """返回当前 AI 配置状态（不含敏感信息）"""
    return get_ai_config()


# ── 非流式聊天 ──


@router.post("/chat", response_model=ChatResponseSchema)
async def chat(req: ChatRequestSchema):
    """
    非流式 AI 对话
    
    前端发送 messages → 后端调用 Provider → 返回完整回复。
    所有 AI 密钥均存储在服务器 .env 中，前端不接触任何密钥。
    """
    if not is_ai_available():
        raise HTTPException(
            status_code=503,
            detail="AI 服务未配置。请在 backend/.env 中设置 AI_API_KEY",
        )

    provider = get_provider()
    options = ChatOptions(
        messages=[ChatMessage(**m) for m in req.messages],
        temperature=req.temperature,
        max_tokens=req.max_tokens,
        model=req.model,
    )
    
    try:
        resp = await provider.chat(options)
    except Exception as e:
        logger.error("AI chat error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=f"AI 调用失败: {e}")

    return ChatResponseSchema(content=resp.content, model=resp.model)


# ── SSE 流式聊天 ──


@router.post("/stream")
async def stream_chat(req: ChatRequestSchema):
    """
    SSE 流式 AI 对话
    
    后端从模型接收 SSE 流，原样转发给前端（EventSource / fetch）。
    格式：data: {delta_text}\n\ndata: [DONE]\n\n
    """
    if not is_ai_available():
        raise HTTPException(
            status_code=503,
            detail="AI 服务未配置",
        )

    provider = get_provider()
    options = ChatOptions(
        messages=[ChatMessage(**m) for m in req.messages],
        temperature=req.temperature,
        max_tokens=req.max_tokens,
        model=req.model,
    )

    async def event_generator():
        try:
            async for delta in provider.stream_chat(options):
                # 每个文本片段封装为 SSE data 行
                yield f"data: {json.dumps(delta, ensure_ascii=False)}\n\n"
            # 流结束标志
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error("AI stream error: %s", e, exc_info=True)
            yield f"data: [ERROR] {str(e)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # 禁用 Nginx 缓冲
            "Connection": "keep-alive",
        },
    )
