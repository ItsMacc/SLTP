from enum import Enum
from app.database.fetch import get_stock_history, get_stock_histories
from app.utils.StockData import StockData
from typing import Any
from app.utils.StrategyDecision import StrategyDecision


class RiskProfile(Enum):
    LOW = 'low'
    MODERATE = 'moderate'
    HIGH = 'high'


class PortfolioRiskManager:
    def __init__(self, risk: RiskProfile = RiskProfile.MODERATE):
        # Risk settings
        self.risk_profile = risk

        # Universe
        self.tickers: list[str] = []
        self.histories: dict[str: StockData] = {}

        # Position tracking
        self.active_positions: int = 0
        self.trades: dict[str, dict[str, Any]] = {}

        # Performance tracking
        self.portfolio_index: float = 100.00

    def add_ticker(self, ticker: str, start_date: str | None = None, end_date: str | None = None) -> None:
        self.histories[ticker] = get_stock_history(ticker, start_date, end_date)
        self.tickers.append(ticker)

    def add_tickers(self, tickers: list[str], start_date: str | None=None, end_date: str | None=None) -> None:
        self.histories.update(get_stock_histories(tickers, start_date, end_date))
        self.tickers.extend(tickers)

    def on_signal(self, ticker: str, decision: StrategyDecision) -> dict[str, Any] | None:
        raise NotImplementedError("PortfolioRiskManager subclasses must implement on_signal()")

    # ---- Setter ----
    def set_risk(self, risk: RiskProfile):
        self.risk_profile = RiskProfile(str(risk).lower())