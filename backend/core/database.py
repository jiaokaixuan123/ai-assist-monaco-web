from motor.motor_asyncio import AsyncIOMotorClient
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "python_edu"
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # ── AI 配置（供 ai/provider_registry.py 使用）─────────
    AI_PROVIDER: str = "glm4"                    # glm4 / openai_compat
    AI_MODEL: str = ""                           # 空=使用 provider 默认模型
    AI_API_KEY: str = ""                         # API 密钥（留空则 AI 功能不可用）
    AI_API_URL: str = ""                         # 自定义 API 地址（空则用 provider 默认值）

    class Config:
        env_file = ".env"


settings = Settings()

client: Optional[AsyncIOMotorClient] = None


async def connect_db():
    global client
    client = AsyncIOMotorClient(settings.MONGODB_URL)


async def close_db():
    global client
    if client:
        client.close()


def get_db():
    return client[settings.DB_NAME]
