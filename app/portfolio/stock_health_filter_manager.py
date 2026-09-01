import numpy as np
from datetime import datetime
from app.portfolio.portfolio_manager import *
from app.utils.StrategyDecision import StrategyDecision
from app.database.db import load_symbols
from app.database.fetch import get_stock_histories


class StockHealthFilterManager(PortfolioManager):
    def __init__(self):
        super().__init__()

        # Initial Configurations
        self.max_positions = 10
        self.risk_profile = RiskProfile.MODERATE
        self.REBALANCE_FREQUENCY = RebalanceFrequency.QUARTERLY
        self.WARM_UP_PERIOD = 60

        # Initialize universe
        self.initialize_universe()

    def on_signal(self,
                  ticker: str,
                  decision: StrategyDecision
                  ) -> None:
        # Ignore signal if the action is not a BUY order
        if decision.signal != "BUY":
            return

        # Ignore signal if an open position already exists for the ticker
        if self.open_positions.get(ticker, False):
            return

        # Ignore signal if stock is blacklisted
        if ticker in self.blacklisted_tickers:
            return

        # Retrieve stock history and ensure sufficient data points are available for ATR calculation
        history = self.histories.get(ticker)
        if not history or len(history.close_price) < 15:
            return

        # Extract current close price from decision metrics
        metrics = decision.metrics
        current_close = metrics.get('close_price', 0.0)
        if current_close <= 0:
            return

        # Compute Average True Range (ATR) over the last 14 periods
        high, low, close = history.high, history.low, history.close_price
        tr = np.maximum(high[1:] - low[1:], np.maximum(abs(high[1:] - close[:-1]), abs(low[1:] - close[:-1])))
        atr = float(np.mean(tr[-14:]))

        k_multiplier = 2.0
        rrr = 2.0

        # Calculate stop loss and take profit price levels based on ATR
        sl_distance = k_multiplier * atr
        stop_loss = round(current_close - sl_distance, 2)
        take_profit = round(current_close + (sl_distance * rrr), 2)

        # Compute adjusted allocation size using base allocation and confidence score
        base_allocation = self.compute_allocation_size()
        confidence = max(0.0, min(1.0, decision.confidence))

        allocation_size = round(min(1.0, base_allocation * (1.0 + confidence)), 4)

        # Create a pending trade record using signal metadata
        signal_date = decision.meta_data.get("signal_date", "")
        pending_record = TradeRecord(
            ticker=ticker,
            action="PENDING_BUY",
            entry_date="",
            allocation_size=allocation_size,
            entry_price=current_close,
            stop_loss=stop_loss,
            take_profit=take_profit,
            signal_date=signal_date,
        )

        # Store pending entry record if not already present for the ticker
        if ticker not in self.pending_entries:
            self.pending_entries[ticker] = pending_record

    def on_rebalance(self, current_date: str) -> None:
        # Parse the current date string into a datetime object
        curr_dt = datetime.strptime(current_date, "%Y-%m-%d")

        # Check if enough time has elapsed since the last rebalance based on frequency settings
        if self.LAST_REBALANCE_DATE is not None:
            last_dt = datetime.strptime(self.LAST_REBALANCE_DATE, "%Y-%m-%d")
            next_due_date = last_dt + REBALANCE_SETTINGS[self.REBALANCE_FREQUENCY]
            if curr_dt < next_due_date:
                return

        # Update last rebalance date tracking
        self.LAST_REBALANCE_DATE = current_date

        # Clean up previously blacklisted tickers whose positions have now been sold off/closed
        newly_cleaned_blacklisted = set()
        for ticker in list(self.blacklisted_tickers):
            if not self.open_positions.get(ticker, False):
                if ticker in self.tickers:
                    self.tickers.remove(ticker)
                if ticker in self.histories:
                    del self.histories[ticker]
                newly_cleaned_blacklisted.add(ticker)
        for ticker in newly_cleaned_blacklisted:
            self.blacklisted_tickers.remove(ticker)

        # Find stocks that lost the most based on realized trade records/returns
        ticker_performance = {}
        for ticker, trade_list in self.trades.items():
            returns = [t.realized_return_pct for t in trade_list if t.realized_return_pct is not None]
            if returns:
                ticker_performance[ticker] = sum(returns)

        # Sort by worst performance (most negative realized returns first)
        sorted_by_worst = sorted(ticker_performance.items(), key=lambda x: x[1])
        tickers_to_remove = [t for t, ret in sorted_by_worst if ret < 0]

        removed_count = 0
        for ticker in tickers_to_remove:
            if ticker not in self.tickers:
                continue

            # If the stock has an active position, blacklist it instead of immediate removal
            if self.open_positions.get(ticker, False):
                self.blacklisted_tickers.add(ticker)
            else:
                # Fully remove the stock if no active position exists
                self.tickers.remove(ticker)
                if ticker in self.histories:
                    del self.histories[ticker]
                removed_count += 1

        # Go through the entire universe and add back `removed_count` stocks using the initial check
        if removed_count > 0:
            all_symbols = load_symbols()
            histories = get_stock_histories(all_symbols)

            scored_stocks = []
            existing_set = set(self.tickers) | self.blacklisted_tickers

            for ticker, history in histories.items():
                if ticker in existing_set:
                    continue

                # Check BEFORE anything else if the whole history has enough bars to eventually support warmup
                if history is None or len(history.close_price) < self.WARM_UP_PERIOD:
                    continue

                recent_close = history.close_price[-self.WARM_UP_PERIOD:]
                recent_volume = history.volume[-self.WARM_UP_PERIOD:]

                # Check growth rate constraint
                growth_rate = (recent_close[-1] - recent_close[0]) / recent_close[0]
                if growth_rate <= 0:
                    continue

                # Calculate liquidity score (average volume)
                avg_volume = float(np.mean(recent_volume))
                scored_stocks.append((ticker, avg_volume, history))

            # Sort by liquidity/volume in descending order
            scored_stocks.sort(key=lambda x: x[1], reverse=True)

            # Add back n stocks matching the count of successfully removed ones
            added = 0
            for ticker, avg_volume, history in scored_stocks:
                if added >= removed_count:
                    break
                self.tickers.append(ticker)
                self.histories[ticker] = history
                added += 1

    def initialize_universe(self) -> None:
        # Load all available symbols and fetch their historical data
        all_symbols = load_symbols()
        histories = get_stock_histories(all_symbols)

        scored_stocks = []
        for ticker, history in histories.items():
            # Check BEFORE anything else if the whole history meets the warmup requirement length
            if history is None or len(history.close_price) < self.WARM_UP_PERIOD:
                continue

            recent_close = history.close_price[-self.WARM_UP_PERIOD:]
            recent_volume = history.volume[-self.WARM_UP_PERIOD:]

            # Check if growth rate has been strictly greater than 0 over the last 60 days
            growth_rate = (recent_close[-1] - recent_close[0]) / recent_close[0]
            if growth_rate <= 0:
                continue

            # Calculate average volume over the warmup period to determine liquidity
            avg_volume = float(np.mean(recent_volume))
            scored_stocks.append((ticker, avg_volume, history))

        # Sort by liquidity/volume in descending order (highest volume first)
        scored_stocks.sort(key=lambda x: x[1], reverse=True)

        # Select the top 50 stocks
        top_50 = scored_stocks[:50]

        # Populate the universe tickers and their corresponding histories
        for ticker, avg_volume, history in top_50:
            self.tickers.append(ticker)
            self.histories[ticker] = history