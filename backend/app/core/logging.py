import logging
import logging.config
import sys
import os
from app.core.trace import TraceFilter

_LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")
_LOG_FILE = os.path.join(_LOG_DIR, "backend.log")


def _ensure_log_dir():
    os.makedirs(_LOG_DIR, exist_ok=True)


_LOG_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "trace": {
            "()": TraceFilter,
        },
    },
    "formatters": {
        "default": {
            "format": "%(asctime)s [%(trace_id)s] %(name)s - %(levelname)s - %(message)s",
        },
    },
    "handlers": {
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": _LOG_FILE,
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 30,
            "encoding": "utf-8",
            "formatter": "default",
            "filters": ["trace"],
            "level": "INFO",
        },
        "console": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
            "formatter": "default",
            "filters": ["trace"],
            "level": "INFO",
        },
    },
    "root": {
        "level": "INFO",
        "handlers": ["file", "console"],
    },
    "loggers": {
        "httpx": {"level": "WARNING", "handlers": []},
        "httpcore": {"level": "WARNING", "handlers": []},
        "uvicorn": {"level": "INFO", "handlers": []},
        "uvicorn.access": {"level": "INFO", "handlers": []},
        "uvicorn.error": {"level": "INFO", "handlers": []},
    },
}


def setup_logging():
    _ensure_log_dir()
    logging.config.dictConfig(_LOG_CONFIG)
