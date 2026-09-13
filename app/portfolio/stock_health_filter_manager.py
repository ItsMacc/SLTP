import numpy as np
import talib as ta
from datetime import datetime
from dateutil.relativedelta import relativedelta
from app.portfolio.portfolio_manager import (
    PortfolioManager, REBALANCE_SETTINGS,
    RebalanceFrequency, TradeRecord, UNIVERSE
)
from app.utils.StrategyDecision import StrategyDecision
from app.database.fetch import get_stock_histories, get_stock_history, get_all_stocks


class StockHealthFilterManager(PortfolioManager):
    def __init__(self):
        super().__init__()

        # Initial Configurations
        self.max_positions = 20
        self.REBALANCE_FREQUENCY = RebalanceFrequency.QUARTERLY
        self.WARM_UP_PERIOD = 60

    def on_signal(self,
                  ticker: str,
                  decision: StrategyDecision
                  ) -> TradeRecord:
        # Ignore signal if signal is not BUY
        if decision.signal != "BUY":
            return None

        # Ignore signal if an open position already exists for the ticker
        if self.open_positions.get(ticker, False):
            return None

        # Ignore signal if stock is blacklisted
        if ticker in self.blacklisted_tickers:
            return None

        # Retrieve stock history and ensure sufficient data points are available for ATR calculation
        history = self.histories.get(ticker)
        if not history or len(history.close_price) < 15:
            return None

        # Find the exact index of the signal date so we don't use future data
        signal_date = decision.meta_data.get("signal_date", "")
        if signal_date not in history.dates:
            return None

        day_idx = list(history.dates).index(signal_date)
        if day_idx < 14:  # Need at least 15 points for 14-period ATR
            return None

        # Slice historical arrays strictly up to the signal date
        highs = history.high[:day_idx + 1][-15:]
        lows = history.low[:day_idx + 1][-15:]
        closes = history.close_price[:day_idx + 1][-15:]

        if len(closes) < 15:
            return None

        # Extract current close price from decision metrics
        metrics = decision.metrics
        current_close = metrics.get('close_price', 0.0)
        if current_close <= 0:
            return None

        # Compute Average True Range (ATR) over the last 14 periods
        atr = ta.ATR(np.array(highs), np.array(lows), np.array(closes))[-1]
        if np.isnan(atr) or atr <= 0:
            return None

        k_multiplier = 4.0
        rrr = 2.0

        # Calculate stop loss and take profit price levels based on ATR
        sl_distance = k_multiplier * atr
        stop_loss = round(current_close - sl_distance, 2)
        take_profit = round(current_close + (sl_distance * rrr), 2)

        # Compute adjusted allocation size using base allocation and confidence score
        base_allocation = self._base_allocation()
        confidence = max(0.0, min(1.0, decision.confidence))

        allocation_size = round(min(1.0, base_allocation * confidence), 2)

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
        new_blacklist = set()
        for ticker in list(self.blacklisted_tickers):
            if not self.open_positions.get(ticker, False):
                if ticker in self.tickers:
                    self.tickers.remove(ticker)
                if ticker in self.histories:
                    del self.histories[ticker]
                new_blacklist.add(ticker)

        for ticker in new_blacklist:
            self.blacklisted_tickers.remove(ticker)

        # Evaluate performance (net of wins and losses)
        ticker_performance: dict[str, float] = {}
        for ticker in self.tickers:
            loss_results = self.ticker_losses.get(ticker, [0.0])
            win_results = self.ticker_wins.get(ticker, [0.0])
            ticker_performance[ticker] = sum(loss_results) + sum(win_results)

        # Sort by worst net performance
        sorted_by_worst = sorted(ticker_performance.items(), key=lambda x: x[1])
        tickers_to_remove = [t for t, net in sorted_by_worst if net < 0]

        # Remove underperformers (or blacklist if active position exists)
        removed = 0
        for ticker in tickers_to_remove:
            if ticker not in self.tickers:
                continue

            if self.open_positions.get(ticker, False):
                self.blacklisted_tickers.add(ticker)
            else:
                self.tickers.remove(ticker)
                if ticker in self.histories:
                    del self.histories[ticker]
                removed += 1

        # Refill exact 'removed' count using our parameterized helper
        if removed > 0:
            replacements = self._get_top_candidates(current_date, n=removed, exclude_current=True)

            # Log if we couldn't fully replace everyone
            if len(replacements) < removed:
                print(f"Warning on {current_date}: Wanted {removed} replacements, but only found {len(replacements)}")

            for ticker, avg_volume in replacements:
                self.tickers.append(ticker)
                self.histories[ticker] = get_stock_history(ticker)


    def initialize_universe(self, current_date: str) -> bool:
        # Fetch top qualifying candidates
        n = 50
        top = self._get_top_candidates(current_date, n=n, exclude_current=False)

        if len(top) < n:
            return False

        # Populate universe
        self.tickers.clear()
        self.histories.clear()
        for ticker, avg_volume in top:
            self.tickers.append(ticker)
            self.histories[ticker] = get_stock_history(ticker)

        return True

    def _get_top_candidates(self,
                            current_date: str,
                            n: int,
                            exclude_current: bool = False
                            ) -> list[tuple[str, float]]:
        # Fetch historical data with safety margin up to current_date
        start_date = datetime.strptime(current_date, "%Y-%m-%d") - relativedelta(days=self.WARM_UP_PERIOD * 2)
        start_date_str = start_date.strftime("%Y-%m-%d")
        histories = get_stock_histories(UNIVERSE, start=start_date_str, end=current_date)

        exclude_set = set(self.tickers) | self.blacklisted_tickers if exclude_current else set()

        scored_stocks = []
        for ticker, history in histories.items():
            if exclude_current and ticker in exclude_set:
                continue

            if history is None:
                continue

            recent_close = history.close_price[-self.WARM_UP_PERIOD + 1:]
            recent_volume = history.volume[-self.WARM_UP_PERIOD + 1:]

            # Check growth rate constraint point-in-time
            growth_rate = (recent_close[-1] - recent_close[0]) / recent_close[0]
            if growth_rate <= 0:
                continue

            # Calculate liquidity score (average volume) up to current_date
            avg_volume = float(np.mean(recent_volume))
            scored_stocks.append((ticker, avg_volume))

        # Sort by liquidity/volume in descending order
        scored_stocks.sort(key=lambda x: x[1], reverse=True)

        # Return exactly top n
        return scored_stocks[:n]
