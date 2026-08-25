from dataclasses import dataclass, field
from typing import Any


@dataclass()
class StrategyDecision:
    signal: str
    confidence: float
    metrics: dict[str, float] = field(default_factory=dict)
    meta_data: dict[str, Any] = field(default_factory=dict)
