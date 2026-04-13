"""AI Provider 工厂 & 单例管理"""

from .base import BaseProvider
from .providers.glm4 import Glm4Provider
from .providers.openai_compat import OpenAICompatProvider

# 注册表：provider 名称 → 类
_PROVIDER_MAP: dict[str, type[BaseProvider]] = {
    "glm4": Glm4Provider,
    "openai_compat": OpenAICompatProvider,
}

# 单例缓存
_provider_instance: BaseProvider | None = None


def get_provider() -> BaseProvider:
    """
    获取当前配置的 AI Provider 实例（懒加载单例）。
    
    首次调用时根据 Settings.AI_PROVIDER 创建实例，
    后续调用直接返回同一实例。

    Raises:
        ValueError: .env 中 AI_PROVIDER 配置了未注册的名称
    """
    global _provider_instance

    if _provider_instance is not None:
        return _provider_instance

    from core.database import settings

    name = settings.AI_PROVIDER.strip().lower()
    cls = _PROVIDER_MAP.get(name)

    if cls is None:
        available = ", ".join(sorted(_PROVIDER_MAP.keys()))
        raise ValueError(
            f"未知的 AI Provider: '{name}'，可选值: {available}"
        )

    _provider_instance = cls()
    return _provider_instance


def is_ai_available() -> bool:
    """
    检查 AI 功能是否可用（已配置 + API Key 非空）。
    
    用途：
      - 路由层判断返回 503 还是正常响应
      - 前端查询是否显示 AI 相关 UI 元素
    """
    try:
        provider = get_provider()
        return provider.configured
    except Exception:
        return False


def get_ai_config() -> dict:
    """
    返回当前 AI 配置摘要（不含敏感信息），
    可供 /api/ai/status 等端点使用。
    """
    from core.database import settings

    return {
        "provider": settings.AI_PROVIDER,
        "model": settings.AI_MODEL,
        "configured": is_ai_available(),
        "has_api_key": bool(settings.AI_API_KEY),
    }
