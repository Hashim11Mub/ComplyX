from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file: backend/app/config.py → backend/ → ComplyX/
_ENV_FILE = Path(__file__).parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), extra="ignore")

    anthropic_api_key: str = ""
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "sama_regulations"
    embedding_model: str = "intfloat/multilingual-e5-large"
    corpus_version: str = "2026-07"

    # LangSmith (optional — set to enable tracing)
    langchain_tracing_v2: bool = False
    langchain_api_key: str = ""
    langchain_project: str = "complyx-amad"


settings = Settings()
