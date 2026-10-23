import os
from dataclasses import dataclass
from typing import List


@dataclass
class Config:
    """Configuration for the translation worker."""

    redis_host: str
    redis_port: int
    queue_key: str
    result_channel: str
    source_language: str
    supported_languages: List[str]
    log_level: str

    @classmethod
    def from_env(cls) -> "Config":
        """Create configuration from environment variables."""
        return cls(
            redis_host=os.getenv("REDIS_HOST", "localhost"),
            redis_port=int(os.getenv("REDIS_PORT", "6379")),
            queue_key="translation:queue",
            result_channel="translation:results",
            source_language=os.getenv("SOURCE_LANGUAGE", "en"),
            supported_languages=["es", "fr", "de"],
            log_level=os.getenv("LOG_LEVEL", "info").upper(),
        )
