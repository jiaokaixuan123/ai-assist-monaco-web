"""AI Provider 实现：OpenAI 兼容协议（GPT / DeepSeek / Qwen / Ollama 等）"""
import json
import httpx

from ..base import BaseProvider, ChatOptions, ChatResponse, ChatMessage
from core.database import settings


class OpenAICompatProvider(BaseProvider):
    """
    OpenAI 及兼容协议的通用 Provider

    适用范围：
      - OpenAI (GPT-3.5 / GPT-4 / o1/o3 系列)
      - DeepSeek (deepseek-chat / deepseek-reasoner)
      - 通义千问 DashScope 兼容模式
      - Groq
      - 本地 Ollama
      - 其他任何兼容 /v1/chat/completions 的服务
    """

    def __init__(self) -> None:
        self._api_key: str = settings.AI_API_KEY
        self._api_url: str = settings.AI_API_URL
        self._default_model: str = settings.AI_MODEL or "gpt-3.5-turbo"
        self._headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
        }

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    async def chat(self, options: ChatOptions) -> ChatResponse:
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
                        continue


def _msg_to_dict(msg: ChatMessage) -> dict:
    return {"role": msg.role, "content": msg.content}


def _raise_for_error(resp: httpx.Response) -> None:
    if resp.status_code >= 400:
        try:
            err_body = resp.json()
            detail = err_body.get("error", {}).get(
                "message", err_body.get("error", resp.text)
            )
        except Exception:
            detail = resp.text
        raise httpx.HTTPStatusError(
            f"API 错误 {resp.status_code}: {detail}",
            request=resp.request,
            response=resp,
        )
