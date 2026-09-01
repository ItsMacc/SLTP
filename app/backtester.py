from datetime import datetime
from dateutil.relativedelta import relativedelta
from app.strategies.base import Strategy
from app.utils.StockData import StockData
import numpy as np
import math


def backtest_strategy(strategy: Strategy, period: int = 1):
    # Create sliced_history object once so we can reuse it
    sliced_history = StockData("", [], [], [], [], [], [])

    # Find the start date string
    start_date = datetime.now() - relativedelta(years=period)
    start_date_str = start_date.strftime("%Y-%m-%d")

    manager = strategy.manager
    histories = manager.histories

    if not histories:
        return

    # Align and collect all unique trading dates across all tickers chronologically
    all_dates = sorted(list(set(d for h in histories.values() for d in h.dates)))
    valid_dates = [d for d in all_dates if d >= start_date_str]
    if not valid_dates:
        return

    manager.equity_curve = []

    # Pre-cache index mappings for each ticker
    ticker_data = {}
    for ticker, history in histories.items():
        # Use searchsorted for fast index finding since dates are sorted
        dates = history.dates
        start_idx = np.searchsorted(dates, start_date_str)
        if start_idx >= len(dates):
            continue

        ticker_data[ticker] = {
            "dates": dates,
            "open": history.open_price,
            "high": history.high,
            "low": history.low,
            "close": history.close_price,
            "volume": history.volume,
            "start_idx": start_idx,
            "date_to_idx": {d: idx for idx, d in enumerate(dates)}
        }

    # Outer loop: Iterate chronologically day by day across the portfolio
    for current_date in valid_dates:
        # Rebalance
        strategy.manager.on_rebalance(current_date)

        # Evaluate each ticker active on this specific date
        for ticker, data in ticker_data.items():
            date_map = data["date_to_idx"]
            if current_date not in date_map:
                continue

            i = date_map[current_date]

            # Ensure we only backtest past our start index window
            if i < data["start_idx"]:
                continue

            current_high = float(data["high"][i])
            current_low = float(data["low"][i])
            current_open = float(data["open"][i])
            current_close = float(data["close"][i])

            # Check existing positions for stop-loss or take-profit exits
            manager.check_exits(ticker, current_date, current_high, current_low)

            # Process pending entry orders at today's open price
            if ticker in manager.pending_entries:
                manager.process_pending_entries(ticker, current_open, current_date)

            # Slice historical data up to the current day for signal evaluation
            sliced_history.ticker = ticker
            sliced_history.dates = data["dates"][:i + 1]
            sliced_history.open_price = data["open"][:i + 1]
            sliced_history.high = data["high"][:i + 1]
            sliced_history.low = data["low"][:i + 1]
            sliced_history.close_price = data["close"][:i + 1]
            sliced_history.volume = data["volume"][:i + 1]

            # Generate strategy signals and register them if valid
            try:
                decision = strategy.generate_signal(ticker, sliced_history)
                if decision.signal == "BUY":
                    manager.on_signal(ticker, decision)
            except ValueError:
                pass

            # Update open position values using today's close price
            manager.mark_to_market(ticker, current_close)

        # Record a single clean portfolio-wide equity point per calendar day
        manager.equity_curve.append(
            {
                "date": current_date,
                "portfolio_value": round(manager.portfolio_index, 2)
            }
        )


def backtest_results(strategy: Strategy) -> dict:
    """
    Computes and aggregates backtest performance metrics and structured logs
    suitable for database persistence and frontend display.
    """
    manager = strategy.manager
    equity_curve = manager.equity_curve

    # Initial & Final Portfolio Value
    initial_portfolio_value = equity_curve[0]["portfolio_value"] if equity_curve else 100.0
    final_portfolio_value = equity_curve[-1]["portfolio_value"] if equity_curve else manager.portfolio_index

    # Winning & 2. Losing Trades Extraction
    winning_trades = []
    losing_trades = []

    for ticker, trades in manager.trades.items():
        for t in trades:
            if t.realized_return_pct is not None:
                trade_dict = {
                    "ticker": t.ticker,
                    "action": t.action,
                    "entry_date": t.entry_date,
                    "exit_date": t.exit_date,
                    "entry_price": t.entry_price,
                    "exit_price": t.exit_price,
                    "return_pct": round(t.realized_return_pct * 100, 2),
                    "transaction_cost": t.transaction_cost
                }
                if t.realized_return_pct >= 0:
                    winning_trades.append(trade_dict)
                else:
                    losing_trades.append(trade_dict)

    # Average Win / Loss
    win_returns = [t["return_pct"] for t in winning_trades]
    loss_returns = [t["return_pct"] for t in losing_trades]
    avg_win = round(float(np.mean(win_returns)), 2) if win_returns else 0.0
    avg_loss = round(float(np.mean(loss_returns)), 2) if loss_returns else 0.0

    # PNL Ratio (Profit Factor)
    total_gains = sum(win_returns) if win_returns else 0.0
    total_losses = abs(sum(loss_returns)) if loss_returns else 0.0
    pnl_ratio = round(total_gains / total_losses, 2) if total_losses > 0 else (float('inf') if total_gains > 0 else 0.0)

    # Total Fees
    total_fees = round(manager.total_transactions_cost, 4)

    # Extract daily returns from equity curve for risk metrics
    values = np.array([pt["portfolio_value"] for pt in equity_curve]) if equity_curve else np.array([100.0])
    if len(values) > 1:
        daily_returns = np.diff(values) / values[:-1]
    else:
        daily_returns = np.array([0.0])

    mean_return = np.mean(daily_returns)
    std_return = np.std(daily_returns, ddof=1) if len(daily_returns) > 1 else 0.0

    # Sharpe Ratio (Annualized)
    sharpe_ratio = round(float((mean_return / std_return) * np.sqrt(252)), 4) if std_return > 0 else 0.0

    # Sortino Ratio (Downside Deviation, Annualized)
    negative_returns = daily_returns[daily_returns < 0]
    downside_std = np.std(negative_returns, ddof=1) if len(negative_returns) > 1 else 0.0
    sortino_ratio = round(float((mean_return / downside_std) * np.sqrt(252)), 4) if downside_std > 0 else 0.0

    # Max Drawdown
    if len(values) > 0:
        peak = np.maximum.accumulate(values)
        drawdown = (values - peak) / peak
        max_drawdown = round(float(np.min(drawdown) * 100), 2)
    else:
        max_drawdown = 0.0

    # CAGR (Compound Annual Growth Rate)
    n_days = len(values)
    if n_days > 1 and initial_portfolio_value > 0:
        years = n_days / 252.0
        cagr = round(float(((final_portfolio_value / initial_portfolio_value) ** (1 / years) - 1) * 100), 2) if years > 0 else 0.0
    else:
        cagr = 0.0

    # PSR (Probabilistic Sharpe Ratio)
    def norm_cdf(x):
        return 0.5 * (1.0 + math.erf(x / np.sqrt(2.0)))

    psr = 0.0
    if len(daily_returns) > 2 and std_return > 0:
        n = len(daily_returns)
        skew = np.mean(((daily_returns - mean_return) / std_return) ** 3)
        kurt = np.mean(((daily_returns - mean_return) / std_return) ** 4)
        sr_benchmark = 0.0
        denom = np.sqrt(1.0 - skew * (sharpe_ratio / np.sqrt(252)) + (kurt - 1.0) / 4.0 * ((sharpe_ratio / np.sqrt(252)) ** 2))
        if denom > 0:
            psr_stat = ((sharpe_ratio / np.sqrt(252) - sr_benchmark) * np.sqrt(n - 1)) / denom
            psr = round(float(norm_cdf(psr_stat)), 4)

    # Current Holdings (Invested Amount and Open Positions)
    current_holdings = []
    total_invested_amount = 0.0
    for ticker, is_open in manager.open_positions.items():
        if is_open and ticker in manager.trades and manager.trades[ticker]:
            last_trade = manager.trades[ticker][-1]
            if last_trade.action == "BUY":
                allocated_val = final_portfolio_value * last_trade.allocation_size
                total_invested_amount += allocated_val
                current_holdings.append({
                    "ticker": ticker,
                    "entry_date": last_trade.entry_date,
                    "entry_price": last_trade.entry_price,
                    "allocation_size": last_trade.allocation_size,
                    "current_invested_value": round(allocated_val, 2),
                    "stop_loss": last_trade.stop_loss,
                    "take_profit": last_trade.take_profit
                })

    # Structured JSON object ordered logically for Database & Frontend
    return {
        "portfolio_summary": {
            "initial_portfolio_value": round(initial_portfolio_value, 2),
            "final_portfolio_value": round(final_portfolio_value, 2),
            "cagr_pct": cagr,
            "total_fees": total_fees,
            "max_drawdown_pct": max_drawdown
        },
        "performance_and_risk_metrics": {
            "sharpe_ratio": sharpe_ratio,
            "sortino_ratio": sortino_ratio,
            "psr": psr,
            "pnl_ratio": pnl_ratio,
            "average_win_pct": avg_win,
            "average_loss_pct": avg_loss
        },
        "trade_statistics": {
            "total_winning_trades": len(winning_trades),
            "total_losing_trades": len(losing_trades),
            "winning_trades_list": winning_trades,
            "losing_trades_list": losing_trades
        },
        "current_holdings": {
            "total_invested_amount": round(total_invested_amount, 2),
            "holdings": current_holdings
        },
        "equity_curve": equity_curve
    }