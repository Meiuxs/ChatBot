import base64
import hashlib
import logging
from functools import lru_cache
from cryptography.fernet import Fernet, InvalidToken
from app.core.config import get_settings

logger = logging.getLogger(__name__)


class EncryptionKeyMissingError(Exception):
    """Raised when api_key_secret is not configured."""


@lru_cache(maxsize=1)
def _build_fernet() -> Fernet:
    """
    Build a Fernet instance from configured api_key_secret.
    Falls back to supabase_key when api_key_secret is not set.
    Cached via lru_cache to avoid repeated SHA-256 computation.
    """
    settings = get_settings()
    source = settings.api_key_secret or settings.supabase_key
    if not source:
        raise EncryptionKeyMissingError(
            "API_KEY_SECRET is not configured. "
            "Set it in .env (generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\")"
        )
    digest = hashlib.sha256(source.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_api_key(raw: str) -> str:
    if not raw:
        return ""
    fernet = _build_fernet()
    token = fernet.encrypt(raw.encode("utf-8"))
    logger.info("SECURITY encrypt_api_key input_len=%d output_len=%d", len(raw), len(token))
    return token.decode("utf-8")


def decrypt_api_key(cipher_text: str) -> str:
    if not cipher_text:
        return ""
    try:
        fernet = _build_fernet()
        plain = fernet.decrypt(cipher_text.encode("utf-8"))
        logger.info("SECURITY decrypt_api_key input_len=%d output_len=%d", len(cipher_text), len(plain))
        return plain.decode("utf-8")
    except InvalidToken:
        logger.error("SECURITY decrypt_api_key FAILED — invalid or encrypted with a different key")
        raise ValueError("API Key 解密失败，密钥可能已变更")
