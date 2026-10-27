# statistical_mean_reversion_manager.py — Manager for the Statistical Mean Reversion (SMR) strategy.
#
# Universe: top 100 liquid stocks and ETFs by 12-month trailing dollar volume
# (with dedicated slots guaranteed for ETFs via db.load_etfs()), rebuilt annually
# via on_rebalance (underperforming candidates removed, fresh high-volume stocks/ETFs
# brought in; open losers are blacklisted until exit).
# Position sizing scales the base (Kelly) allocation by signal confidence based on
# Z-Score extremity (Z < -1.5), operating with a 3.0 StDev take-profit and RSI > 70 exits.

# -------- Imports --------
import numpy as np
from datetime import datetime
from dateutil.relativedelta import relativedelta
from app.engine.portfolio.portfolio_manager import (
    PortfolioManager, RebalanceFrequency, TradeRecord
)
from app.engine.utils.StrategyDecision import StrategyDecision, Signal
from app.database.fetch import get_stock_histories


# -------- Statistical Mean Reversion Manager Class --------
class StatisticalMeanReversionManager(PortfolioManager):
    def __init__(self):
        super().__init__()

        # Initial Configurations
        self.max_positions = 25
        self.UNIVERSE_SIZE = 100
        self.ETF_QUOTA = 20
        self.REBALANCE_FREQUENCY = RebalanceFrequency.YEARLY
        self.WARM_UP_PERIOD = 252  # ~1 trading year for trailing dollar volume calculation

    # -------- Lifecycle Hooks --------
    def on_signal(self,
                  ticker: str,
                  decision: StrategyDecision
                  ) -> TradeRecord | None:
        # This strategy is long-only; it does not open SHORT positions.
        if decision.signal is not Signal.LONG:
            return None

        # Ignore signal if an open position already exists for the ticker
        if self.open_positions.get(ticker, False):
            return None

        # Ignore signal if stock is blacklisted
        if ticker in self.blacklisted_tickers:
            return None

        # Calculate stop loss and take profit levels using 3.0 StDev from current close
        # Read both straight from the signal metrics so this never dereferences a
        # history the universe no longer holds.
        current_close = decision.metrics.get("close_price", 0.0)
        stdev = decision.metrics.get("stdev", 0.0)
        if current_close <= 0 or stdev <= 0:
            return None

        # Place the stop and target 3.0 StDev away from the signal close
        sl_distance = 3.0 * stdev
        stop_loss = round(current_close - sl_distance, 2)
        take_profit = round(current_close + sl_distance, 2)

        # Compute adjusted allocation size: base allocation scaled upward by confidence
        base_allocation = self._base_allocation()
        confidence = max(0.0, min(1.0, decision.confidence))

        # Scaling factor: higher confidence increases allocation above base
        scaling_multiplier = 1.0 + confidence
        allocation_size = round(min(1.0, base_allocation * scaling_multiplier), 4)

        # Create a pending trade record using signal metadata
        signal_date = decision.meta_data.get("signal_date", "")
        return TradeRecord(
            ticker=ticker,
            action="BUY",
            entry_date=None,
            allocation_size=allocation_size,
            entry_price=None,
            stop_loss=stop_loss,
            take_profit=take_profit,
            signal_date=signal_date,
        )

    def on_rebalance(self, current_date: str) -> None:
        # Clean up blacklisted tickers whose positions have closed
        super().on_rebalance(current_date)

        # Blacklist any currently held positions so they aren't removed from histories
        for ticker in list(self.tickers):
            if self.open_positions.get(ticker, False):
                self.blacklisted_tickers.add(ticker)
            else:
                self.tickers.remove(ticker)
                if ticker in self.histories:
                    del self.histories[ticker]

        # Held names already occupy their slots, so only fill the vacancies. This
        # keeps the universe at its target size instead of growing every rebalance.
        vacancies = max(0, self.UNIVERSE_SIZE - len(self.tickers))
        if vacancies == 0:
            return

        top_candidates = self._get_top_candidates(
            current_date,
            n=vacancies,
            etf_quota=min(self.ETF_QUOTA, vacancies),
            exclude=self.blacklisted_tickers,
        )

        # Add new tickers that are not already in tickers or blacklisted
        tickers_to_add = [t for t in top_candidates if t not in self.tickers and t not in self.blacklisted_tickers]

        # Load full history so freshly added names carry their indicator warm-up;
        # the backtester anchors each ticker at current_date and only trades bars
        # from that point on.
        if tickers_to_add:
            self.add_tickers(tickers_to_add)

    def initialize_universe(self, current_date: str) -> bool:
        # Fetch qualifying candidates with reserved ETF slots on start
        top_candidates = self._get_top_candidates(
            current_date,
            n=self.UNIVERSE_SIZE,
            etf_quota=self.ETF_QUOTA,
        )
        if not top_candidates:
            return False

        # Populate universe cleanly. Full history is kept so RSI/ATR/Z-Score have
        # their warm-up on the first simulated day; the backtester's start_idx
        # stops anything before current_date from being traded.
        self.tickers.clear()
        self.histories.clear()
        self.add_tickers(top_candidates)

        return len(self.tickers) > 0

    def _get_top_candidates(self,
                            current_date: str,
                            n: int = 100,
                            etf_quota: int = 20,
                            exclude: set[str] | None = None,
                            ) -> list[str]:
        # Fetch historical data with safety lookback margin up to current_date
        start_date = datetime.strptime(current_date, "%Y-%m-%d") - relativedelta(days=self.WARM_UP_PERIOD * 2)
        start_date_str = start_date.strftime("%Y-%m-%d")
        universe = self.get_available_universe

        # Pull official ETF list from base class property
        known_etfs = set(self.get_available_etfs)

        histories = get_stock_histories(universe, start=start_date_str, end=current_date)

        scored_stocks = []
        scored_etfs = []

        for ticker, history in histories.items():
            if history is None or len(history.close_price) < self.WARM_UP_PERIOD:
                continue

            # Calculate trailing 12-month dollar volume over warm-up period
            recent_closes = history.close_price[-self.WARM_UP_PERIOD:]
            recent_volumes = history.volume[-self.WARM_UP_PERIOD:]
            trailing_dollar_volume = float(np.sum(recent_closes * recent_volumes))

            if ticker in known_etfs:
                scored_etfs.append((ticker, trailing_dollar_volume))
            else:
                scored_stocks.append((ticker, trailing_dollar_volume))

        # Drop excluded names before ranking so they don't consume the quota
        if exclude:
            scored_etfs = [pair for pair in scored_etfs if pair[0] not in exclude]
            scored_stocks = [pair for pair in scored_stocks if pair[0] not in exclude]

        # Sort descending by trailing dollar volume
        scored_etfs.sort(key=lambda x: x[1], reverse=True)
        scored_stocks.sort(key=lambda x: x[1], reverse=True)

        # Select top ETFs up to the quota (never more than the requested count)
        selected_etfs = [t for t, score in scored_etfs[:min(etf_quota, n)]]

        # Fill remaining slots with top individual stocks
        stock_quota = max(0, n - len(selected_etfs))
        selected_stocks = [t for t, score in scored_stocks[:stock_quota]]

        return selected_etfs + selected_stocks
