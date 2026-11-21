"""Settings from environment variables (api/.env fills in anything not set). Secrets never have real defaults."""

from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PLACEHOLDERS = {"change-me", "replace-with-a-long-random-string-at-least-32-chars", "choose-a-strong-password"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    secret_key: SecretStr

    mongo_url: str = "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true"
    mongo_db: str = "conferencehub"
    redis_url: str = "redis://localhost:6379/0"
    # Prefix for every Redis key, so tests (and several apps on one Redis) never collide.
    redis_prefix: str = "cm3"

    frontend_url: str = "http://localhost:3100"
    cors_origins: list[str] = ["http://localhost:3100"]
    cookie_secure: bool = False

    access_token_minutes: int = 15
    refresh_token_days: int = 30
    verify_code_minutes: int = 15
    password_reset_hours: int = 2

    # The admin account is created once, on first start, from these two values. The password is never logged.
    admin_email: str = "admin@example.com"
    admin_initial_password: SecretStr | None = None

    log_format: Literal["console", "json"] = "console"
    log_level: str = "INFO"
    sentry_dsn: str | None = None

    @field_validator("secret_key")
    @classmethod
    def strong_secret(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value()
        if len(raw) < 32 or raw in PLACEHOLDERS:
            raise ValueError("SECRET_KEY must be a random string of at least 32 characters")
        return value

    @field_validator("admin_initial_password")
    @classmethod
    def no_placeholder_password(cls, value: SecretStr | None) -> SecretStr | None:
        if value is None or not value.get_secret_value():
            return None
        raw = value.get_secret_value()
        if raw in PLACEHOLDERS or len(raw) < 10:
            raise ValueError("ADMIN_INITIAL_PASSWORD must be your own password of at least 10 characters")
        return value

    @model_validator(mode="after")
    def production_is_locked_down(self) -> "Settings":
        if self.environment == "production" and not self.cookie_secure:
            raise ValueError("COOKIE_SECURE must be true in production")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # values (including the required SECRET_KEY) come from the environment
