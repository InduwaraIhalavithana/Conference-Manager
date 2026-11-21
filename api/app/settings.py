"""Settings from environment variables (api/.env fills in anything not set)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongo_url: str = "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true"
    mongo_db: str = "conferencehub"
    cors_origins: list[str] = ["http://localhost:3100"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
