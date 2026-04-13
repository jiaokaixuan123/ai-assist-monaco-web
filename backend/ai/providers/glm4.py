"""AI Provider 实现：GLM-4 系列（智谱）"""
import json
import httpx

from ..base import BaseProvider, ChatOptions, ChatResponse, ChatMessage
from core.database import settings


class Glm4Provider(BaseProvider):
    """
    智谱 GLM-4 系列适配器

    特点：
      - 完全兼容 OpenAI /v1/chat/completions 协议
      - 支持 SSE 流式输出
      - glm-4-flash 免费但有 RPM/TPM 限制
    """

    def __init__(self) -> None:
        self._api_key: str = settings.AI_API_KEY
        self._api_url: str = settings.AI_API_URL
        self._default_model: str = settings.AI_MODEL or "glm-4-flash"
        self._headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
        }

    # ── 公开属性 ──

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    # ── 核心方法 ──

    async def chat(self, options: ChatOptions) -> ChatResponse:
        """非流式聊天请求"""
        model = options.model or self._default_model
        payload = {
            "model": model,
            "messages": [_msg_to_dict(m) for m in options.messages],
            "temperature": options.temperature,
            "max_tokens": options.max_tokens,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self._api_url, headers=self._headers, json=payload)
            _raise_for_error(resp)
            data = resp.json()

        choice = (data.get("choices") or [{}])[0]
        content = (choice.get("message") or {}).get("content", "")
        used_model = data.get("model", model)

        return ChatResponse(content=content, model=used_model, raw=data)

    async def stream_chat(self, options: ChatOptions):
        """SSE 流式聊天，逐 yield 文本片段"""
        model = options.model or self._default_model
        payload = {
            "model": model,
            "messages": [_msg_to_dict(m) for m in options.messages],
            "temperature": options.temperature,
            "max_tokens": options.max_tokens,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST", self._api_url, headers=self._headers, json=payload
            ) as resp:
                _raise_for_error(resp)
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[len("data: "):].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = (
                            (chunk.get("choices") or [{}])[0]
                            .get("delta", {})
                            .get("content", "")
                        )
                        if delta:
                            yield delta
                    except (json.JSONDecodeError, IndexError, KeyError):
                        # 忽略解析失败的行（keep-alive 注释等）
                        continue


# ── 内部工具 ──


def _msg_to_dict(msg: ChatMessage) -> dict:
    return {"role": msg.role, "content": msg.content}


def _raise_for_error(resp: httpx.Response) -> None:
    """统一错误处理"""
    if resp.status_code >= 400:
        try:
            detail = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            detail = resp.text
        raise httpx.HTTPStatusError(
            f"GLM API 错误 {resp.status_code}: {detail}",
            request=resp.request,
            response=resp,
        )
