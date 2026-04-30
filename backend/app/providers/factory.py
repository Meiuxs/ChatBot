from app.providers.base import AIProvider
from app.providers.openai import OpenAIProvider


_providers: dict[str, type[AIProvider]] = {
    "openai": OpenAIProvider,
}


def get_provider(name: str) -> AIProvider:
    provider_cls = _providers.get(name)
    if not provider_cls:
        raise ValueError(f"Unknown provider: {name}")
    return provider_cls()


def register_provider(name: str, provider_cls: type[AIProvider]):
    _providers[name] = provider_cls
