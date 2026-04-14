from motor.motor_asyncio import AsyncIOMotorClient
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "python_edu"
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

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
