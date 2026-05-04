import logging
from app.providers.base import AIProvider
from app.providers.openai import OpenAIProvider
from app.providers.deepseek import DeepSeekProvider

logger = logging.getLogger(__name__)

_providers: dict[str, type[AIProvider]] = {
    "openai": OpenAIProvider,
    "deepseek": DeepSeekProvider,
}


def get_provider(name: str) -> AIProvider:
    provider_cls = _providers.get(name)
    if not provider_cls:
        logger.error("PROVIDER unknown name=%s available=%s", name, list(_providers.keys()))
        raise ValueError(f"Unknown provider: {name}")
    logger.info("PROVIDER get name=%s cls=%s", name, provider_cls.__name__)
    return provider_cls()


def register_provider(name: str, provider_cls: type[AIProvider]):
    _providers[name] = provider_cls
    logger.info("PROVIDER registered name=%s cls=%s", name, provider_cls.__name__)


def get_provider_for_model(model: str) -> str:
    if model.startswith("deepseek-"):
        return "deepseek"
    return "openai"
