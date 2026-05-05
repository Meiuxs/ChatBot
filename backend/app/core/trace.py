import logging
from contextvars import ContextVar

trace_id_var: ContextVar[str] = ContextVar("trace_id", default="-")


def get_trace_id() -> str:
    return trace_id_var.get()


def set_trace_id(trace_id: str) -> None:
    trace_id_var.set(trace_id)


class TraceFilter(logging.Filter):
    """在每个日志记录的 record 上注入 trace_id 字段。"""

    def filter(self, record: logging.LogRecord) -> bool:
        record.trace_id = get_trace_id()
        return True
