// LabResultsWindow.tsx — the report a Lab strategy run opens.
//
// QuantConnect opens results beside the code; the Lab opens them over it. One
// scrollable sheet: headline returns against buy-and-hold SPY, the equity
// curve and benchmark, every metric the engine returned, and a paginated trade
// blotter. The download is the same normalized object the window is built
// from, so a result can leave the browser intact.

import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Download, Pencil, ScrollText, X } from 'lucide-react';
import Button from '../ui/Button';
import { backtestRange, type LabBacktestPayload, type LabTrade } from './backtestTypes';
import './LabResultsWindow.css';

interface LabResultsWindowProps {
  result: LabBacktestPayload;
  fileName: string;
  workspaceName: string;
  /** The saved backtest this report belongs to, when it has one. */
  backtestName?: string;
  backtestId?: string;
  createdAt?: string;
  /** Persists a renamed backtest; omitted for a result that was not saved. */
  onRename?: (name: string) => Promise<void>;
  /** Why the result is not in the account store, when saving failed. */
  saveError?: string | null;
  onClose: () => void;
}

const CHART_W = 1000;
const CHART_H = 340;
const CHART = { top: 20, right: 24, bottom: 34, left: 62 };
const TRADES_PER_PAGE = 20;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/* ---------- Formatting ---------- */

const percentKeys = new Set(['cagr', 'max_drawdown', 'win_rate', 'loss_rate', 'turnover', 'cost_drag']);
const decimalKeys = new Set([
  'starting_value',
  'ending_value',
  'sharpe',
  'sortino',
  'psr',
  'expectancy',
  'average_win',
  'average_loss',
  'total_trading_cost',
  'unrealized_profit',
  'dividend_income',
  'borrow_cost',
]);

const metricLabels: Record<string, string> = {
  starting_value: 'Starting value',
  ending_value: 'Ending value',
  cagr: 'CAGR',
  sharpe: 'Sharpe',
  sortino: 'Sortino',
  psr: 'PSR',
  max_drawdown: 'Max drawdown',
  win_rate: 'Win rate',
  loss_rate: 'Loss rate',
  average_win: 'Average win',
  average_loss: 'Average loss',
  expectancy: 'Expectancy',
  turnover: 'Turnover',
  cost_drag: 'Cost drag',
  total_trading_cost: 'Trading cost',
  unrealized_profit: 'Unrealized P&L',
  drawdown_recovery: 'Recovery',
  dividend_income: 'Dividends',
  borrow_cost: 'Borrow cost',
};

const metricOrder = [
  'cagr',
  'sharpe',
  'sortino',
  'psr',
  'max_drawdown',
  'win_rate',
  'expectancy',
  'turnover',
  'cost_drag',
  'total_trading_cost',
  'starting_value',
  'ending_value',
  'drawdown_recovery',
  'unrealized_profit',
  'dividend_income',
  'borrow_cost',
];

const formatMoney = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatSigned = (value: number, decimals = 2) => {
  const text = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${text}`;
};

const formatPercent = (value: number) => `${formatSigned(value, 2)}%`;

function formatMetric(key: string, value: number | string | boolean | null): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '—';
  if (percentKeys.has(key)) return `${value.toFixed(2)}%`;
  if (key === 'drawdown_recovery') return `${Math.round(value)} days`;
  if (decimalKeys.has(key)) return value.toFixed(2);
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
}

function metricLabel(key: string): string {
  if (metricLabels[key]) return metricLabels[key];
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const formatDate = (iso: string) => {
  if (!iso) return '—';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatSavedAt = (iso?: string) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatAxisDate = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

/* ---------- Outcome helpers ---------- */

function tradeOutcome(trade: LabTrade) {
  if (!trade.exit) return null;
  const entry = trade.entry_price;
  const exit = trade.exit.price;
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(exit)) return null;
  const long = trade.position_type !== 'short';
  const returnPct = long ? ((exit - entry) / entry) * 100 : ((entry - exit) / entry) * 100;
  const pnl =
    (returnPct / 100) * trade.allocation * trade.equity_at_entry -
    (trade.fees || 0) +
    (trade.dividend_income || 0);
  return { returnPct, pnl };
}

function totalReturn(points: { value: number }[]): number {
  if (points.length < 2) return 0;
  const first = points[0]?.value ?? 0;
  return first > 0 ? ((points[points.length - 1]!.value - first) / first) * 100 : 0;
}

/* ---------- Equity + benchmark chart ---------- */

function EquityChart({ result, fileName }: { result: LabBacktestPayload; fileName: string }) {
  const [hover, setHover] = useState<number | null>(null);

  const dates = useMemo(() => result.equity.map((point) => point.date), [result.equity]);
  const benchmarkByDate = useMemo(
    () => new Map(result.benchmark.map((point) => [point.date, point.value])),
    [result.benchmark],
  );
  const benchmarkValues = useMemo(
    () => dates.map((date) => benchmarkByDate.get(date) ?? null),
    [dates, benchmarkByDate],
  );

  const range = useMemo(() => {
    const values = [...result.equity.map((point) => point.value), ...result.benchmark.map((point) => point.value)];
    const low = Math.min(...values);
    const high = Math.max(...values);
    const padding = (high - low) * 0.08 || 1;
    return { min: Math.max(0, low - padding), max: high + padding };
  }, [result.equity, result.benchmark]);

  const plotWidth = CHART_W - CHART.left - CHART.right;
  const plotHeight = CHART_H - CHART.top - CHART.bottom;
  const xAt = (index: number) =>
    CHART.left + (dates.length <= 1 ? plotWidth / 2 : (index / (dates.length - 1)) * plotWidth);
  const yAt = (value: number) =>
    CHART.top + (1 - (value - range.min) / (range.max - range.min)) * plotHeight;

  const strategyPoints = result.equity.map((point, index) => `${xAt(index)},${yAt(point.value)}`).join(' ');
  const benchmarkPoints = benchmarkValues
    .map((value, index) => (value === null ? null : `${xAt(index)},${yAt(value)}`))
    .filter(Boolean)
    .join(' ');
  const areaPoints = `${CHART.left},${CHART.top + plotHeight} ${strategyPoints} ${xAt(
    result.equity.length - 1,
  )},${CHART.top + plotHeight}`;

  const gridTicks = Array.from({ length: 5 }, (_, index) => range.min + ((range.max - range.min) * index) / 4);
  const dateTickIndexes = Array.from(
    new Set([0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(fraction * (dates.length - 1)))),
  );

  const hoverPoint = hover === null ? null : result.equity[hover] ?? null;
  const hoverBenchmark = hover === null ? null : benchmarkValues[hover];

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * CHART_W;
    const ratio = clamp((px - CHART.left) / plotWidth, 0, 1);
    setHover(Math.round(ratio * Math.max(0, dates.length - 1)));
  };

  return (
    <div className="lab-results-chart">
      <div className="lab-results-chart-legend">
        <span className="lab-results-legend-item">
          <i className="lab-results-legend-swatch is-strategy" />
          {result.strategy_name || fileName.replace(/\.py$/, '')}
        </span>
        {result.benchmark.length > 0 && (
          <span className="lab-results-legend-item">
            <i className="lab-results-legend-swatch is-benchmark" />
            Buy &amp; hold SPY
          </span>
        )}
        <span className="lab-results-chart-axis-note">index, starts at 100</span>
      </div>

      <div className="lab-results-chart-wrap">
        <svg
          className="lab-results-chart-svg"
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          role="img"
          aria-label="Strategy equity against buy and hold"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="lab-equity-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={CHART.left}
                x2={CHART_W - CHART.right}
                y1={yAt(tick)}
                y2={yAt(tick)}
                className="lab-results-grid-line"
              />
              <text x={CHART.left - 10} y={yAt(tick) + 4} textAnchor="end" className="lab-results-axis-label">
                {tick.toFixed(1)}
              </text>
            </g>
          ))}

          <polygon points={areaPoints} fill="url(#lab-equity-fill)" />
          {result.benchmark.length > 0 && (
            <polyline points={benchmarkPoints} className="lab-results-benchmark-line" />
          )}
          <polyline points={strategyPoints} className="lab-results-strategy-line" />

          {dateTickIndexes.map((index) => (
            <text
              key={dates[index]}
              x={xAt(index)}
              y={CHART_H - 12}
              textAnchor={index === 0 ? 'start' : index === dates.length - 1 ? 'end' : 'middle'}
              className="lab-results-axis-label"
            >
              {formatAxisDate(dates[index] ?? '')}
            </text>
          ))}

          {hoverPoint && hover !== null && (
            <g pointerEvents="none">
              <line
                x1={xAt(hover)}
                x2={xAt(hover)}
                y1={CHART.top}
                y2={CHART.top + plotHeight}
                className="lab-results-crosshair"
              />
              <circle cx={xAt(hover)} cy={yAt(hoverPoint.value)} r={4} className="lab-results-hover-dot" />
              {hoverBenchmark !== null && (
                <circle
                  cx={xAt(hover)}
                  cy={yAt(hoverBenchmark)}
                  r={3.5}
                  className="lab-results-hover-dot is-benchmark"
                />
              )}
            </g>
          )}
        </svg>

        {hoverPoint && hover !== null && (
          <div
            className="lab-results-chart-tip"
            style={{ left: `${clamp((xAt(hover) / CHART_W) * 100, 10, 90)}%` }}
          >
            <span className="lab-results-tip-date">{formatDate(hoverPoint.date)}</span>
            <span className="lab-results-tip-row">
              <i className="lab-results-legend-swatch is-strategy" />
              <span>{hoverPoint.value.toFixed(2)}</span>
            </span>
            {hoverBenchmark !== null && (
              <span className="lab-results-tip-row">
                <i className="lab-results-legend-swatch is-benchmark" />
                <span>{hoverBenchmark.toFixed(2)}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Small pieces ---------- */

function SummaryCard({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
  note?: string;
}) {
  return (
    <div className={`lab-results-summary-card${tone ? ` is-${tone}` : ''}`}>
      <span className="lab-results-summary-label">{label}</span>
      <span className="lab-results-summary-value">{value}</span>
      {note && <span className="lab-results-summary-note">{note}</span>}
    </div>
  );
}

function TradeRow({ trade }: { trade: LabTrade }) {
  const outcome = tradeOutcome(trade);
  const closed = trade.exit !== null;
  const won = outcome ? outcome.pnl >= 0 : null;

  return (
    <tr className={closed ? (won ? 'is-win' : 'is-loss') : 'is-open'}>
      <td data-label="Entry">{formatDate(trade.entry_date)}</td>
      <td className="lab-results-ticker" data-label="Symbol">{trade.ticker}</td>
      <td data-label="Side">
        <span className={`lab-results-side is-${trade.position_type === 'short' ? 'short' : 'long'}`}>
          {trade.position_type === 'short' ? 'SHORT' : 'LONG'}
        </span>
      </td>
      <td data-label="Allocation">{(trade.allocation * 100).toFixed(2)}%</td>
      <td data-label="Entry price">${formatMoney(trade.entry_price)}</td>
      <td data-label="Exit">
        {trade.exit ? (
          <>
            {formatDate(trade.exit.date)}
            <span className="lab-results-exit-reason">{trade.exit.type.replace(/_/g, ' ').toLowerCase()}</span>
          </>
        ) : (
          'Open'
        )}
      </td>
      <td data-label="Exit price">{trade.exit ? `$${formatMoney(trade.exit.price)}` : '—'}</td>
      <td className="lab-results-fees" data-label="Fees">${formatMoney(trade.fees || 0)}</td>
      <td className={won === null ? '' : won ? 'is-positive' : 'is-negative'} data-label="P&L">
        {outcome ? `${outcome.pnl >= 0 ? '+' : '−'}$${formatMoney(Math.abs(outcome.pnl))}` : '—'}
      </td>
      <td className={won === null ? '' : won ? 'is-positive' : 'is-negative'} data-label="Return">
        {outcome ? formatPercent(outcome.returnPct) : '—'}
      </td>
    </tr>
  );
}

/* ---------- The window ---------- */

export default function LabResultsWindow({
  result,
  fileName,
  workspaceName,
  backtestName,
  backtestId,
  createdAt,
  onRename,
  saveError,
  onClose,
}: LabResultsWindowProps) {
  const [page, setPage] = useState(1);
  const fallbackName = result.strategy_name || fileName.replace(/\.py$/, '') || 'Backtest';
  const [displayName, setDisplayName] = useState(backtestName ?? fallbackName);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const orderedMetrics = useMemo(() => {
    const entries = Object.entries(result.stats).filter(
      ([key, value]) =>
        key !== 'equity' &&
        value !== null &&
        (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'),
    );
    const byKey = new Map(entries);
    const ordered = metricOrder
      .filter((key) => byKey.has(key))
      .map((key) => [key, byKey.get(key)!] as const);
    const seen = new Set(ordered.map(([key]) => key));
    const extras = entries
      .filter(([key]) => !seen.has(key))
      .sort(([a], [b]) => a.localeCompare(b));
    return [...ordered, ...extras];
  }, [result.stats]);

  const orderedTrades = useMemo(
    () => [...result.trades].sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.id - b.id),
    [result.trades],
  );
  const pageCount = Math.max(1, Math.ceil(orderedTrades.length / TRADES_PER_PAGE));
  const visibleTrades = orderedTrades.slice((page - 1) * TRADES_PER_PAGE, page * TRADES_PER_PAGE);
  const closedTrades = orderedTrades.filter((trade) => trade.exit !== null);

  const strategyReturn = totalReturn(result.equity);
  const benchmarkReturn = totalReturn(result.benchmark);
  const hasBenchmark = result.benchmark.length > 1;
  const excess = hasBenchmark ? strategyReturn - benchmarkReturn : null;

  const commitName = async () => {
    const next = draftName.trim();
    if (!next || next === displayName) {
      setEditingName(false);
      setDraftName(displayName);
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      if (onRename) await onRename(next);
      setDisplayName(next);
      setEditingName(false);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Could not rename this backtest.');
    } finally {
      setSavingName(false);
    }
  };

  const logs = result.logs ?? [];
  const logText = logs.map((entry) => entry.text).join('');
  const savedAt = formatSavedAt(createdAt);

  const downloadLogs = () => {
    const slug =
      displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'backtest';
    const text = logText.trimEnd();
    const blob = new Blob([text ? `${text}\n` : ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug}-logs.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const download = () => {
    const slug =
      `${workspaceName}-${displayName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'lab-backtest';
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug}-result.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const titleId = 'lab-results-title';

  return (
    <div
      className="lab-results-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="lab-results-window" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="lab-results-head">
          <div className="lab-results-heading">
            <p className="lab-results-kicker">
              Backtest result{backtestId ? ` · ${backtestId}` : ''}
            </p>
            {editingName ? (
              <form
                className="lab-results-name-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitName();
                }}
              >
                <input
                  className="lab-results-name-input"
                  aria-label="Backtest name"
                  value={draftName}
                  maxLength={80}
                  autoFocus
                  disabled={savingName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setDraftName(displayName);
                      setEditingName(false);
                      setNameError(null);
                    }
                  }}
                />
                <Button
                  variant="primary"
                  size="icon"
                  aria-label="Save backtest name"
                  title="Save name"
                  disabled={savingName}
                  type="submit"
                >
                  <Check size={15} aria-hidden="true" />
                </Button>
              </form>
            ) : (
              <div className="lab-results-title-row">
                <h2 className="lab-results-title" id={titleId}>{displayName}</h2>
                {onRename && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Rename backtest"
                    title="Rename backtest"
                    onClick={() => {
                      setDraftName(displayName);
                      setNameError(null);
                      setEditingName(true);
                    }}
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </Button>
                )}
              </div>
            )}
            {nameError && <p className="lab-results-name-error">{nameError}</p>}
            <p className="lab-results-subtitle">
              {result.strategy_name ? `${result.strategy_name} · ` : ''}
              {backtestRange(result)} · {fileName}
              {savedAt ? ` · saved ${savedAt}` : ''}
            </p>
            {saveError && (
              <p className="lab-results-save-error">
                This run was not saved: {saveError}
              </p>
            )}
          </div>
          <div className="lab-results-head-actions">
            <Button variant="secondary" size="sm" onClick={download}>
              <Download size={14} aria-hidden="true" />
              Download JSON
            </Button>
            <Button variant="ghost" size="icon" aria-label="Close results" onClick={onClose} autoFocus>
              <X size={18} aria-hidden="true" />
            </Button>
          </div>
        </header>

        <div className="lab-results-body">
          <div className="lab-results-summary">
            <SummaryCard
              label="Strategy return"
              value={formatPercent(strategyReturn)}
              tone={strategyReturn > 0 ? 'positive' : strategyReturn < 0 ? 'negative' : 'neutral'}
              note={`${result.equity.length.toLocaleString()} sessions`}
            />
            {hasBenchmark && (
              <SummaryCard
                label="Buy & hold SPY"
                value={formatPercent(benchmarkReturn)}
                tone={benchmarkReturn > 0 ? 'positive' : benchmarkReturn < 0 ? 'negative' : 'neutral'}
                note="same dates, whole book"
              />
            )}
            {excess !== null && (
              <SummaryCard
                label="Excess return"
                value={formatPercent(excess)}
                tone={excess > 0 ? 'positive' : excess < 0 ? 'negative' : 'neutral'}
                note="strategy minus benchmark"
              />
            )}
            <SummaryCard
              label="Max drawdown"
              value={formatMetric('max_drawdown', result.stats.max_drawdown ?? null)}
              tone="negative"
              note="peak to trough"
            />
            <SummaryCard
              label="Sharpe"
              value={formatMetric('sharpe', result.stats.sharpe ?? null)}
              tone={Number(result.stats.sharpe) >= 1 ? 'positive' : 'neutral'}
              note="return per unit of risk"
            />
            <SummaryCard
              label="Win rate"
              value={closedTrades.length ? formatMetric('win_rate', result.stats.win_rate ?? null) : '—'}
              tone={
                closedTrades.length && Number(result.stats.win_rate) >= 50 ? 'positive' : 'neutral'
              }
              note={`${closedTrades.length.toLocaleString()} closed trades`}
            />
          </div>

          <section className="lab-results-card">
            <div className="lab-results-card-head">
              <h3>Equity curve</h3>
              <span>Growth of 100</span>
            </div>
            <EquityChart result={result} fileName={fileName} />
          </section>

          <section className="lab-results-card">
            <div className="lab-results-card-head">
              <h3>Performance metrics</h3>
              <span>Everything the engine returned</span>
            </div>
            {orderedMetrics.length > 0 ? (
              <dl className="lab-results-metrics">
                {orderedMetrics.map(([key, value]) => {
                  const numeric = typeof value === 'number';
                  const tone =
                    numeric && ['max_drawdown', 'cost_drag', 'total_trading_cost'].includes(key)
                      ? 'is-negative'
                      : numeric && ['cagr', 'sharpe', 'sortino'].includes(key) && value > 0
                        ? 'is-positive'
                        : '';
                  return (
                    <div className="lab-results-metric" key={key}>
                      <dt>{metricLabel(key)}</dt>
                      <dd className={tone}>{formatMetric(key, value)}</dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="lab-results-empty">The engine did not return any metrics for this run.</p>
            )}
          </section>

          <section className="lab-results-card">
            <div className="lab-results-card-head">
              <h3>Trade record</h3>
              <span>
                {orderedTrades.length.toLocaleString()} trade{orderedTrades.length === 1 ? '' : 's'}
              </span>
            </div>

            {orderedTrades.length === 0 ? (
              <p className="lab-results-empty">This run did not execute any trades.</p>
            ) : (
              <>
                <div className="lab-results-table-wrap">
                  <table className="lab-results-table">
                    <thead>
                      <tr>
                        <th>Entry</th>
                        <th>Symbol</th>
                        <th>Side</th>
                        <th>Allocation</th>
                        <th>Entry price</th>
                        <th>Exit</th>
                        <th>Exit price</th>
                        <th>Fees</th>
                        <th>P&amp;L</th>
                        <th>Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTrades.map((trade) => (
                        <TradeRow key={trade.id ?? `${trade.ticker}-${trade.entry_date}`} trade={trade} />
                      ))}
                    </tbody>
                  </table>
                </div>

                {pageCount > 1 && (
                  <div className="lab-results-pagination">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                      aria-label="Previous trades"
                    >
                      Prev
                    </Button>
                    <span>
                      Page {page} of {pageCount}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                      disabled={page === pageCount}
                      aria-label="Next trades"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="lab-results-card">
            <div className="lab-results-card-head">
              <h3>
                <ScrollText size={15} aria-hidden="true" /> Logs
              </h3>
              <Button variant="secondary" size="sm" onClick={downloadLogs}>
                <Download size={14} aria-hidden="true" />
                Download logs (.txt)
              </Button>
            </div>
            <pre className="lab-results-logs" aria-label="Backtest logs">
              {logText || 'Nothing was printed during this run.'}
            </pre>
          </section>

          <p className="lab-results-footnote">
            Computed in your browser by sltp. Fees and slippage are already inside the curve; a
            trade&apos;s P&amp;L is its fill return on the allocated equity, less fees and plus dividends.
          </p>
        </div>
      </section>
    </div>
  );
}
