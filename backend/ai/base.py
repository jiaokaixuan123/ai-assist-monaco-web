"""
AI Provider 抽象基类 & 数据模型

所有模型适配器（GLM、OpenAI、DeepSeek 等）必须实现 BaseProvider 接口，
确保对外暴露统一的 chat / stream_chat 调用方式。
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator


@dataclass
class ChatMessage:
    """统一消息格式"""
    role: str           # system / user / assistant
    content: str


@dataclass
class ChatOptions:
    """聊天请求参数"""
    messages: list[ChatMessage]
    temperature: float = 0.7
    max_tokens: int = 1000
    model: str = ""     # 空字符串 = 使用 provider 默认模型


@dataclass
class ChatResponse:
    """聊天响应"""
    content: str
    model: str
    raw: dict = field(default_factory=dict)   # 原始响应体，供特殊场景使用


class BaseProvider(ABC):
    """
    AI 提供者抽象基类
    
    子类需实现：
      - chat():          同步请求 → 完整回复
      - stream_chat():   异步生成器 → 逐段 yield 文本
      - configured:      是否已正确配置（有 Key 等）
    """

    @abstractmethod
    async def chat(self, options: ChatOptions) -> ChatResponse:
        """普通聊天请求"""
        ...

    @abstractmethod
    async def stream_chat(
        self, options: ChatOptions
    ) -> AsyncIterator[str]:
        """
        流式聊天，每次 yield 一个文本片段（delta）。
        返回异步生成器，支持 SSE 透传。
        """
        ...

    @property
    @abstractmethod
    def configured(self) -> bool:
        """检查是否已正确配置（API Key 非空等）"""
        ...
