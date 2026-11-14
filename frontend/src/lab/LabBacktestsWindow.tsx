// LabBacktestsWindow.tsx — every backtest saved for one Lab workspace.
//
// The list is the saved summaries: name, when it ran, total return and CAGR.
// Choosing one loads the stored JSON and hands it to the same report the live
// run uses, so history and a fresh run are never two different screens.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Loader2, Search, Trash2, X } from 'lucide-react';
import Button from '../ui/Button';
import ConfirmDeleteDialog from '../ui/ConfirmDeleteDialog';
import {
  deleteLabBacktest,
  getLabBacktest,
  listLabBacktests,
  renameLabBacktest,
  type LabBacktestRecord,
  type LabBacktestSummary,
} from './store';
import { isLabBacktestPayload, type LabBacktestPayload } from './backtestTypes';
import { readCachedBacktest, writeCachedBacktest } from './backtestCache';
import LabResultsWindow from './LabResultsWindow';
import './LabBacktestsWindow.css';

const PER_PAGE = 10;

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  const text = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${text}%`;
};

// Same shape as the ticker search: a name prefix comes first, then a name
// match, then strategy matches. Items that do not match at all rank -1.
const searchRank = (item: LabBacktestSummary, query: string) => {
  if (!query) return 0;
  const name = item.name.toLocaleLowerCase();
  const strategy = (item.strategy_name ?? '').toLocaleLowerCase();
  if (name.startsWith(query)) return 0;
  if (name.includes(query)) return 1;
  if (strategy.startsWith(query)) return 2;
  if (strategy.includes(query)) return 3;
  return -1;
};

const matchesSearch = (item: LabBacktestSummary, query: string) =>
  searchRank(item, query) >= 0;

/** Wraps the first case-insensitive match of `query` in a highlighted mark. */
function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const index = text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="lab-history-mark">{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}

interface LabBacktestsWindowProps {
  projectId: string;
  workspaceName: string;
  onClose: () => void;
}

export default function LabBacktestsWindow({
  projectId,
  workspaceName,
  onClose,
}: LabBacktestsWindowProps) {
  const [items, setItems] = useState<LabBacktestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LabBacktestRecord | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LabBacktestSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listLabBacktests(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the saved backtests.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selected || pendingDelete) return;
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
  }, [selected, pendingDelete, onClose]);

  const query = search.trim().toLocaleLowerCase();
  const filtered = useMemo(() => {
    if (!query) return items;
    return items
      .map((item) => ({ item, rank: searchRank(item, query) }))
      .filter((entry) => entry.rank >= 0)
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => entry.item);
  }, [items, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const visible = useMemo(
    () => filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE),
    [filtered, currentPage],
  );

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteLabBacktest(pendingDelete.id);
      const next = items.filter((item) => item.id !== pendingDelete.id);
      const nextFiltered = next.filter((item) => matchesSearch(item, query));
      setItems(next);
      setPage((current) =>
        Math.min(current, Math.max(1, Math.ceil(nextFiltered.length / PER_PAGE))),
      );
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete that backtest.');
    } finally {
      setDeleting(false);
    }
  };

  const open = async (summary: LabBacktestSummary) => {
    setOpening(summary.id);
    setError(null);
    try {
      // The report is immutable, so the cached copy is the whole answer. The
      // list is the authority on name and headline numbers, so it wins on
      // those fields.
      const cached = await readCachedBacktest(summary.id);
      if (cached) {
        setSelected({ ...cached, ...summary });
        return;
      }
      const record = await getLabBacktest(summary.id);
      if (!isLabBacktestPayload(record.payload)) {
        throw new Error('That saved backtest has no readable result.');
      }
      setSelected(record);
      void writeCachedBacktest(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that backtest.');
    } finally {
      setOpening(null);
    }
  };

  const rename = async (name: string) => {
    if (!selected) return;
    const updated = await renameLabBacktest(selected.id, name);
    setSelected((current) => (current ? { ...current, name: updated.name } : current));
    setItems((current) =>
      current.map((item) => (item.id === updated.id ? { ...item, name: updated.name } : item)),
    );
  };

  if (selected && isLabBacktestPayload(selected.payload)) {
    const payload = selected.payload as LabBacktestPayload;
    return (
      <LabResultsWindow
        result={payload}
        fileName={payload.file_name || 'workspace/main.py'}
        workspaceName={workspaceName}
        backtestName={selected.name}
        backtestId={selected.id}
        createdAt={selected.created_at}
        onRename={rename}
        onClose={() => setSelected(null)}
      />
    );
  }

  return (
    <div
      className="lab-history-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="lab-history-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lab-history-title"
      >
        <header className="lab-history-head">
          <div>
            <p className="lab-history-kicker">Saved runs</p>
            <h2 className="lab-history-title" id="lab-history-title">Backtests</h2>
            <p className="lab-history-subtitle">
              {workspaceName} · {items.length.toLocaleString()} saved
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close backtests" onClick={onClose} autoFocus>
            <X size={18} aria-hidden="true" />
          </Button>
        </header>

        <div className="lab-history-body">
          {error && <p className="lab-history-error">{error}</p>}

          {!loading && items.length > 0 && (
            <label className="lab-history-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search backtests by name or strategy"
                aria-label="Search backtests"
              />
            </label>
          )}

          <div className="lab-history-list-wrap">
            {loading ? (
              <div className="lab-history-state">
                <Loader2 size={18} className="lab-history-spinner" aria-hidden="true" />
                Loading saved backtests…
              </div>
            ) : items.length === 0 ? (
              <div className="lab-history-state">
                <BarChart3 size={22} aria-hidden="true" />
                <strong>No backtests yet</strong>
                Run a strategy in the editor and its result will be saved here.
              </div>
            ) : filtered.length === 0 ? (
              <div className="lab-history-state">
                <Search size={22} aria-hidden="true" />
                <strong>No matching backtests</strong>
                Nothing here matches “{search.trim()}”.
                <button type="button" className="lab-history-clear" onClick={() => updateSearch('')}>
                  Clear search
                </button>
              </div>
            ) : (
              <ul className="lab-history-list">
                {visible.map((item) => (
                  <li key={item.id}>
                    <div className="lab-history-row-wrap">
                      <button
                        type="button"
                        className="lab-history-row"
                        onClick={() => void open(item)}
                        disabled={opening !== null}
                      >
                        <span className="lab-history-row-main">
                          <span className="lab-history-name">
                            <Highlight text={item.name} query={query} />
                          </span>
                          <span className="lab-history-meta">
                            {item.strategy_name ? (
                              <Highlight text={item.strategy_name} query={query} />
                            ) : (
                              'Strategy'
                            )}{' '}
                            · {formatDate(item.created_at)}
                          </span>
                        </span>
                        <span className="lab-history-metric">
                          <span>Return</span>
                          <strong className={item.total_return >= 0 ? 'is-positive' : 'is-negative'}>
                            {formatPercent(item.total_return)}
                          </strong>
                        </span>
                        <span className="lab-history-metric">
                          <span>CAGR</span>
                          <strong>{formatPercent(item.cagr)}</strong>
                        </span>
                        <span className="lab-history-open">
                          {opening === item.id ? (
                            <Loader2 size={16} className="lab-history-spinner" aria-hidden="true" />
                          ) : (
                            <ChevronRight size={16} aria-hidden="true" />
                          )}
                        </span>
                      </button>
                      <Button
                        variant="danger"
                        size="icon"
                        className="lab-history-delete"
                        aria-label={`Delete ${item.name} permanently`}
                        title={`Delete ${item.name} permanently`}
                        onClick={() => {
                          setDeleteError(null);
                          setPendingDelete(item);
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!loading && !error && filtered.length > 0 && (
            <div className="lab-history-pagination">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} aria-hidden="true" /> Prev
              </Button>
              <span>Page {currentPage} of {pageCount}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={currentPage === pageCount}
                aria-label="Next page"
              >
                Next <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      </section>

      {pendingDelete && (
        <ConfirmDeleteDialog
          title="Delete backtest"
          description={
            <>
              <strong>{pendingDelete.name}</strong> will be removed from this workspace for good. Its
              saved report cannot be recovered.
            </>
          }
          confirmLabel="Delete backtest"
          busy={deleting}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => {
            if (deleting) return;
            setPendingDelete(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
