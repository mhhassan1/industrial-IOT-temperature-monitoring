"""App configuration from environment; no workplace-specific defaults."""
from dataclasses import dataclass
import os


def _positive(name: str, default: float) -> float:
    val = float(os.getenv(name, str(default)))
    if val <= 0:
        raise ValueError(f"{name} must be positive")
    return val


@dataclass(frozen=True)
class Settings:
    db_path: str = os.getenv("EDGEWATCH_DB", "./data/edgewatch.sqlite3")
    warning_c: float = _positive("WARNING_C", 35)
    critical_c: float = _positive("CRITICAL_C", 45)
    recovery_margin_c: float = _positive("RECOVERY_MARGIN_C", 2)
    stale_seconds: int = int(_positive("STALE_SECONDS", 18))

    def __post_init__(self):
        if self.critical_c <= self.warning_c:
            raise ValueError("CRITICAL_C must exceed WARNING_C")
