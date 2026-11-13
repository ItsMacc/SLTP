// LabPage.tsx — Lab home: a hero in the Home page's voice, the workspace
// panel, and the notes that explain what a run returns. Workspaces are the
// only thing the reader sees; their files sit inside and open together.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, FileCode, Folder, Search, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  createLabStrategy,
  createLabWorkspace,
  deleteLabWorkspace,
  listLabWorkspaces,
  type LabWorkspace,
} from '../lab/store';
import { getTemplate, type LabTemplateId } from '../lab/templates';
import type { LabCreateMode, NewWorkspaceInput } from './LabNewProject';
import Button from '../ui/Button';
import Select from '../ui/Select';
import ConfirmDeleteDialog from '../ui/ConfirmDeleteDialog';
import SuccessToast from '../ui/SuccessToast';
import { LoaderScreen } from '../ui/Loader';
import { hashForLabWorkspace, labWorkspaceIdFromHash } from '../routing';
import './LabPage.css';

const LabEditorPage = lazy(() => import('./LabEditorPage'));
const LabNewProject = lazy(() => import('./LabNewProject'));

/** Wraps the first case-insensitive match of `query` in a highlighted mark. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="lab-mark">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

/**
 * A browser network failure says nothing a reader can act on, so it is
 * dropped. A message the API wrote itself is shown as it came.
 */
function apiErrorMessage(message: string): string | null {
  const raw = message.trim();
  if (!raw) return null;
  const browserLevel = ['failed to fetch', 'load failed', 'networkerror', 'network error', 'fetch failed'];
  return browserLevel.some((phrase) => raw.toLowerCase().includes(phrase)) ? null : raw;
}

/** "Oct 21, 2026" from the ISO timestamps the store keeps. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "1 file" / "3 files". */
function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** The reader-facing name of a file inside its workspace folder. */
function fileLabel(path: string): string {
  return path.replace(/^workspace\//, '');
}

/* ---------- Rules the engine applies for you ---------- */
const FACTS: { title: string; text: string }[] = [
  {
    title: 'Next-open fills',
    text: "A signal is computed from a bar that has already closed, so the trade happens at the next open. Monday's close produces a Tuesday-open fill, never a Monday price. That short delay is the honest cost of acting on a completed bar.",
  },
  {
    title: 'No lookahead',
    text: 'Your code only sees bars up to and including the current day. Indicators are computed causally, so the value at day N is built from days 1 to N and nothing after. Without that rule a backtest is not a test, only a memory of the answer.',
  },
  {
    title: 'Trading costs',
    text: 'Every fill pays 0.05% of slippage that always moves against you, plus a 0.1% fee. An entry and its exit each pay both, so a round trip starts a little behind before the price has done anything. Do not add your own costs on top of these.',
  },
  {
    title: 'Equity-based sizing',
    text: 'The book starts at 100.00, and an allocation is a fraction of current equity rather than a fixed amount of money.',
  },
  {
    title: 'A day to prepare',
    text: "run_daily runs once per day, before any ticker is read, which is where you compute things that must be identical for every stock: a ranking, a market filter, today's shortlist. It receives only the date, so it cannot peek at the day's close. Whatever it stores is what the signals then use.",
  },
  {
    title: 'Position limits',
    text: 'You can go long or short, and set the maximum number of positions, lots per ticker and allocation per ticker. Total exposure cannot exceed equity, so the engine refuses an order that would need borrowed money.',
  },
];

/* ---------- What a run returns ---------- */

/* Each metric gets a name, its full form where the short name hides one, a
   one-line note for scanning, and a paragraph for the reader who wants the
   definition. The note is what the eye lands on first; the paragraph explains
   what the number is made of and how to read it. */
const METRICS: { name: string; full?: string; note: string; text: string }[] = [
  {
    name: 'CAGR',
    full: 'Compound Annual Growth Rate',
    note: 'Yearly growth rate',
    text: "The annualised geometric growth rate of your strategy's equity over the whole backtest. It smooths the run into one yearly figure, which makes strategies of different lengths comparable and lets you set the result against a market benchmark.",
  },
  {
    name: 'Sharpe Ratio',
    note: 'Return per unit of total risk',
    text: 'Return earned above the baseline, divided by the volatility taken to earn it. A higher number means the strategy produced cleaner returns rather than simply carrying more market exposure, which is why it is the first ratio to read.',
  },
  {
    name: 'Sortino Ratio',
    note: 'Return per unit of downside risk',
    text: 'A modification of the Sharpe ratio that counts only downside volatility. Upward moves are ignored, so a strategy is not penalised for large gains, and the score reflects the drops you would actually have sat through.',
  },
  {
    name: 'Probabilistic Sharpe Ratio',
    full: 'PSR',
    note: 'Chance the Sharpe is real, not luck',
    text: 'The probability that the measured Sharpe genuinely beats a baseline of 1.0. It adjusts for non-normal distributions, skew, fat tails and sample size, so a short run needs a much higher Sharpe to earn the same confidence. It is the check against a result that is only luck.',
  },
  {
    name: 'Max Drawdown',
    note: 'Largest fall from a peak',
    text: 'The largest peak-to-trough decline in total equity before a new peak is reached. It is the worst stretch the account would have held through, and it sets the boundary on how much risk the strategy actually carried.',
  },
  {
    name: 'Turnover',
    note: 'How much the book traded, annualized',
    text: 'The value bought and sold, divided by average equity and annualized. A 100% reading means one full equity value was traded in a year. It measures activity rather than skill, and it is the first thing to read before judging a trading-cost number.',
  },
  {
    name: 'Cost Drag',
    note: 'Annualized fees plus slippage',
    text: 'The yearly return given up to fees and slippage, expressed as a percentage of average equity. It is already inside the equity curve, so it is a reporting measure, not another deduction. Compare it with CAGR to see how much of the return trading consumed.',
  },
  {
    name: 'Total Trading Cost',
    note: 'Fees plus slippage since the start',
    text: 'The cumulative fees and slippage paid over the run, in index points. It shows the absolute bill behind the annualized cost drag, and it grows with both turnover and the size of the book.',
  },
  {
    name: 'Win Rate',
    note: 'Share of closed trades that made money',
    text: 'The share of closed positions that finished in profit: winning trades divided by total executed trades. Read it next to the size of the average win and the average loss, because a high hit rate with large losers still loses money.',
  },
  {
    name: 'Expectancy',
    note: 'Average result per closed trade',
    text: 'The average result of one closed trade, combining the win rate with the average win-to-loss ratio. A positive expectancy is what makes a system viable over many trades; a negative one means the wins do not cover the losses and the costs.',
  },
  {
    name: 'Unrealized Profit',
    note: 'Open profit on the last day',
    text: 'The profit or loss still open on the final day of the run: positions bought and not yet sold, marked at the last close. It is paper only until the trade is closed, so it shows how much of the result is still exposed.',
  },
];

/* ---------- Docs pages in reading order ---------- */
const LEARN: { title: string; text: string; slug: string }[] = [
  { title: 'Quickstart', text: 'Run a first strategy in under 20 lines.', slug: 'quickstart' },
  {
    title: 'The Strategy class',
    text: 'Every hook, constraint and indicator you can use.',
    slug: 'strategy-overview',
  },
  { title: 'Metrics reference', text: 'How each number in a result is calculated.', slug: 'metrics' },
  { title: 'Gotchas', text: 'The behaviors that most often surprise people.', slug: 'gotchas' },
];

/* ---------- Sort ---------- */
type SortOrder = 'newest' | 'name';

const SORT_OPTIONS: { label: string; value: SortOrder }[] = [
  { label: 'Newest', value: 'newest' },
  { label: 'Name', value: 'name' },
];

/** What a pending delete will remove. */
type DeleteTarget = {
  id: string;
  name: string;
};

interface LabPageProps {
  onNavigate?: (tab: string) => void;
}

export default function LabPage({ onNavigate }: LabPageProps) {
  const queryClient = useQueryClient();
  // The address owns which workspace is open: #/lab/<workspace-id> opens it
  // directly, and Back returns to the workspace list instead of leaving Lab.
  const [urlWorkspaceId, setUrlWorkspaceId] = useState<string | null>(() => labWorkspaceIdFromHash());
  const [wizard, setWizard] = useState<{
    open: boolean;
    mode: LabCreateMode;
    template: LabTemplateId;
    target: 'existing' | 'new';
  }>({
    open: false,
    mode: 'strategy',
    template: 'blank',
    target: 'existing',
  });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const closeWizard = useCallback(() => setWizard((w) => ({ ...w, open: false })), []);

  // Workspace panel state
  const [workspaces, setWorkspaces] = useState<LabWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const searchRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setUrlWorkspaceId(labWorkspaceIdFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Press "/" anywhere (outside inputs) to focus search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reads the signed-in account's workspaces and their files.
  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listLabWorkspaces();
      setWorkspaces(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your workspaces.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch on the landing page, on a cold direct workspace link, and again
    // when the reader comes back with possibly newer file counts.
    if (!urlWorkspaceId || workspaces.length === 0) void loadWorkspaces();
  }, [urlWorkspaceId, loadWorkspaces, workspaces.length]);

  const q = query.trim().toLowerCase();

  const orderedWorkspaces = useMemo(() => {
    const next = [...workspaces];
    next.sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return next;
  }, [workspaces, sort]);

  const visibleWorkspaces = useMemo(() => {
    if (!q) return orderedWorkspaces;
    return orderedWorkspaces.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.files.some((file) => fileLabel(file.path).toLowerCase().includes(q)),
    );
  }, [orderedWorkspaces, q]);

  const fileCount = workspaces.reduce((n, w) => n + w.file_count, 0);
  const panelState = loading ? 'loading' : loadError ? 'error' : 'ready';

  const openWorkspace = (workspace: LabWorkspace) => {
    if (!workspace.project_id) return;
    window.location.hash = hashForLabWorkspace(workspace.id).slice(1);
    setUrlWorkspaceId(workspace.id);
  };

  const openTarget = useMemo(() => {
    if (!urlWorkspaceId) return null;
    return workspaces.find((workspace) => workspace.id === urlWorkspaceId)
      // Old shared links used the hidden project id; still open the workspace.
      ?? workspaces.find((workspace) => workspace.project_id === urlWorkspaceId)
      ?? null;
  }, [urlWorkspaceId, workspaces]);

  const startWizard = (
    mode: LabCreateMode = 'strategy',
    template: LabTemplateId = 'blank',
    target: 'existing' | 'new' = mode === 'workspace' ? 'new' : 'existing',
  ) => {
    setWizard({ open: true, mode, template, target });
  };

  const toggleExpanded = (workspaceId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(workspaceId)) next.delete(workspaceId);
      else next.add(workspaceId);
      return next;
    });
  };

  /* Docs keeps its current page in the hash, so setting it before switching
     tabs is what opens a specific page rather than the first one. */
  const goToDocs = (slug?: string) => {
    if (slug) window.location.hash = `#/docs/${slug}`;
    onNavigate?.('docs');
  };

  // The wizard adds a strategy file to an existing workspace, or creates a
  // workspace and its first file. The workspace is the only thing we open.
  const handleCreateFromWizard = async (input: NewWorkspaceInput) => {
    // Send the code the wizard showed, so the file the user opens is exactly
    // the template they picked.
    const code = getTemplate(input.template).code;
    const workspace = input.workspaceId
      ? await createLabStrategy(input.workspaceId, input.strategyName, input.template, code)
      : await createLabWorkspace({
          workspace_name: input.workspaceName,
          strategy_name: input.strategyName,
          template: input.template,
          code,
        });
    setWizard((w) => ({ ...w, open: false }));
    setWorkspaces((current) => {
      const rest = current.filter((item) => item.id !== workspace.id);
      return [...rest, workspace];
    });
    if (workspace.project_id) {
      await queryClient.invalidateQueries({
        queryKey: ['lab', 'project-files', workspace.project_id],
      });
    }
    openWorkspace(workspace);
    await loadWorkspaces();
  };

  const askDelete = (target: DeleteTarget) => {
    setDeleteError(null);
    setDeleteTarget(target);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  };

  // Runs only after the user typed CONFIRM in the dialog.
  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteLabWorkspace(deleteTarget.id);
      setDeleteTarget(null);
      await loadWorkspaces();
      setToast(`Workspace “${deleteTarget.name}” deleted`);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete.');
    } finally {
      setDeleting(false);
    }
  };

  if (urlWorkspaceId && loading) {
    return (
      <div className="lab-opening">
        <LoaderScreen label="Opening workspace…" sub="Finding it in your account." />
      </div>
    );
  }

  if (urlWorkspaceId && !loading && (!openTarget || !openTarget.project_id)) {
    return (
      <div className="lab-opening lab-opening-missing">
        <p className="lab-ws-state-title">That workspace is not in this account.</p>
        <p>It may have been deleted, or the link belongs to someone else.</p>
        <Button variant="secondary" size="sm" onClick={() => { window.location.hash = '#/lab'; }}>
          Back to workspaces
        </Button>
      </div>
    );
  }

  if (openTarget && openTarget.project_id) {
    return (
      <Suspense
        fallback={
          <div className="lab-opening">
            <LoaderScreen label="Opening workspace…" sub="Loading the editor." />
          </div>
        }
      >
        <LabEditorPage
          key={openTarget.id}
          project={{ id: openTarget.project_id, name: openTarget.name, created_at: openTarget.created_at }}
          workspaceName={openTarget.name}
          onBack={() => {
            window.location.hash = '#/lab';
            setUrlWorkspaceId(null);
            void loadWorkspaces();
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="lab-root">
      <div className="lab-page">
        <section className="lab-hero" aria-labelledby="lab-hero-title">
          <h1 id="lab-hero-title" className="lab-hero-title">
            A Python workspace for your own strategies.
            {/* The sentence break is the natural one at this size: without it the
                balance puts "Test" at the end of the first line. Hidden on narrow
                screens, where the headline wraps on its own. */}
            <br className="lab-hero-break" />{' '}
          </h1>

          <p className="lab-hero-lede">
            The Lab gives you a workspace, its files and an editor, and Python runs right here in the browser. Write a Strategy, hit Run, and the engine backtests it and saves the report for you.
          </p>

          <div className="lab-hero-actions">
            <Button variant="primary" size="lg" className="lab-hero-new" onClick={() => startWizard()}>
              New strategy
              <ArrowRight size={18} className="lab-btn-icon" />
            </Button>
            <Button variant="link" size="sm" className="lab-hero-link" onClick={() => goToDocs()}>
              Read the docs
              <ArrowRight size={14} className="lab-btn-icon" />
            </Button>

            <p className="lab-hero-note">
              New to the engine?{' '}
              <button type="button" className="lab-inline-link" onClick={() => goToDocs('quickstart')}>
                Start with the quickstart
              </button>
            </p>
          </div>
        </section>

        <section className="lab-ws" aria-labelledby="workspace-title">
          <div className="lab-ws-header">
            <div>
              <h2 id="workspace-title" className="lab-ws-title">Workspaces</h2>
            </div>
            <span className="lab-ws-count">
              {plural(workspaces.length, 'workspace')}, {plural(fileCount, 'file')}
            </span>
          </div>

          <div className="lab-ws-stats" aria-label="Your Lab totals">
            <div className="lab-ws-stat">
              <strong>{workspaces.length}</strong>
              <span>{workspaces.length === 1 ? 'Workspace' : 'Workspaces'}</span>
            </div>
            <div className="lab-ws-stat">
              <strong>{fileCount}</strong>
              <span>{fileCount === 1 ? 'File' : 'Files'}</span>
            </div>
          </div>

          <div className="lab-ws-panel">
            <div className="lab-ws-toolbar">
              <label className="lab-ws-search">
                <Search size={14} aria-hidden="true" className="lab-ws-search-icon" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search workspaces and files"
                  aria-label="Search workspaces and files"
                />
                <kbd className="lab-ws-kbd" aria-hidden="true">/</kbd>
              </label>

              <div className="lab-ws-toolbar-end">
                <div className="lab-ws-sort">
                  <Select
                    options={SORT_OPTIONS}
                    value={sort}
                    onChange={(value) => setSort(value as SortOrder)}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="lab-ws-new"
                  onClick={() => startWizard('workspace', 'blank', 'new')}
                >
                  New workspace
                </Button>
              </div>
            </div>

            <div className="lab-ws-scroll">
              <ul className="lab-ws-cards" data-lab-state={panelState} aria-busy={loading}>
                {loading &&
                  [0, 1].map((row) => (
                    <li key={row} className="lab-ws-card is-skeleton" aria-hidden="true">
                      <span className="lab-skel is-icon" />
                      <div className="lab-ws-card-skeleton-copy">
                        <span className="lab-skel is-name" />
                        <span className="lab-skel is-line" />
                      </div>
                    </li>
                  ))}

                {loading && <li className="lab-sr-only" role="status">Loading workspaces…</li>}

                {!loading && loadError && (
                  <li className="lab-ws-state">
                    <span className="lab-ws-state-title">Could not load your workspaces</span>
                    <span>{apiErrorMessage(loadError) ?? 'Check your connection and try again.'}</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="lab-ws-state-action"
                      onClick={() => void loadWorkspaces()}
                    >
                      Try again
                    </Button>
                  </li>
                )}

                {!loading && !loadError && workspaces.length === 0 && (
                  <li className="lab-ws-state">
                    <span className="lab-ws-state-title">No workspaces yet</span>
                    <span>Create a strategy, or start an empty workspace.</span>
                    <Button
                      variant="primary"
                      size="sm"
                      className="lab-ws-state-action"
                      onClick={() => startWizard()}
                    >
                      New strategy
                    </Button>
                  </li>
                )}

                {!loading && !loadError && workspaces.length > 0 && visibleWorkspaces.length === 0 && (
                  <li className="lab-ws-nomatch">
                    <span>No workspaces match “{query.trim()}”.</span>
                    <button type="button" className="lab-ws-clear" onClick={() => setQuery('')}>
                      Clear search
                    </button>
                  </li>
                )}

                {!loading &&
                  !loadError &&
                  visibleWorkspaces.map((ws) => {
                    const fileMatches = Boolean(
                      q && ws.files.some((file) => fileLabel(file.path).toLowerCase().includes(q)),
                    );
                    const isExpanded = expanded.has(ws.id) || fileMatches;
                    return (
                      <li key={ws.id} className={`lab-ws-card ${isExpanded ? 'is-expanded' : ''}`}>
                        <header className="lab-ws-card-head">
                          <span className="lab-ws-card-icon" aria-hidden="true">
                            <Folder size={18} />
                          </span>
                          <div className="lab-ws-card-copy">
                            <h3 className="lab-ws-card-name">
                              <Highlight text={ws.name} query={q} />
                            </h3>
                            <p className="lab-ws-card-meta">
                              Created {formatDate(ws.created_at)} · {plural(ws.file_count, 'file')}
                            </p>
                          </div>
                          <div className="lab-ws-card-side">
                            <button
                              type="button"
                              className="lab-ws-expand"
                              aria-expanded={isExpanded}
                              aria-controls={`workspace-files-${ws.id}`}
                              onClick={() => toggleExpanded(ws.id)}
                            >
                              <ChevronDown className={isExpanded ? 'is-expanded' : ''} size={14} aria-hidden="true" />
                              {ws.file_count} {ws.file_count === 1 ? 'file' : 'files'}
                            </button>
                            <Button
                              variant="danger"
                              size="icon"
                              className="lab-icon-button lab-icon-button-danger"
                              aria-label={`Delete workspace ${ws.name}`}
                              title={`Delete workspace ${ws.name}`}
                              onClick={() => askDelete({ id: ws.id, name: ws.name })}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </Button>
                            <button
                              type="button"
                              className="lab-ws-open"
                              disabled={!ws.project_id}
                              onClick={() => openWorkspace(ws)}
                            >
                              Open workspace
                              <ArrowRight size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </header>

                        {isExpanded && (
                          <ul className="lab-ws-files" id={`workspace-files-${ws.id}`}>
                            {ws.files.length === 0 && (
                              <li className="lab-ws-state is-inline">No files in this workspace yet.</li>
                            )}
                            {ws.files.map((file) => (
                              <li key={file.path} className="lab-ws-file">
                                <FileCode size={14} aria-hidden="true" />
                                <span className="lab-ws-file-name">
                                  <Highlight text={fileLabel(file.path)} query={q} />
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>

            <div className="lab-ws-footer">
              {q
                ? `Showing ${visibleWorkspaces.length} of ${plural(workspaces.length, 'workspace')}`
                : `${plural(workspaces.length, 'workspace')} · ${plural(fileCount, 'file')}`}
            </div>
          </div>
        </section>

        <section className="lab-section" aria-labelledby="lab-engine">
          <header className="lab-section-head">
            <h2 id="lab-engine" className="lab-section-title">What the engine handles</h2>
            <p className="lab-section-lede">These rules are built in, so you do not code them yourself.</p>
          </header>

          <ul className="lab-facts">
            {FACTS.map((fact) => (
              <li key={fact.title} className="lab-fact">
                <h3 className="lab-fact-title">{fact.title}</h3>
                <p className="lab-fact-text">{fact.text}</p>
              </li>
            ))}
          </ul>

          <p className="lab-engine-note">
            <strong>Worst-case outcomes are assumed.</strong> If one bar touches both your stop
            and your target, the stop is the one taken. If the price gaps through a level, the
            fill is at the open, which can be worse than the level you set.
          </p>
        </section>

        <section className="lab-section" aria-labelledby="lab-results">
          <header className="lab-section-head">
            <h2 id="lab-results" className="lab-section-title">What each run returns</h2>
            <p className="lab-section-lede">
              Every backtest returns more than a final number: an equity curve, the same money
              placed in a benchmark to compare against, and the figures below, which describe
              the path the account took and what it cost to take it.
            </p>
          </header>

          <ul className="lab-metrics">
            {METRICS.map((metric) => (
              <li key={metric.name} className="lab-metric">
                <h3 className="lab-metric-name">
                  {metric.name}
                  {metric.full ? (
                    <span className="lab-metric-full"> ({metric.full})</span>
                  ) : null}
                </h3>
                <p className="lab-metric-note">{metric.note}</p>
                <p className="lab-metric-text">{metric.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="lab-section" aria-labelledby="lab-learn">
          <header className="lab-section-head">
            <h2 id="lab-learn" className="lab-section-title">Learn the engine</h2>
            <p className="lab-section-lede">Start here if you are new to the Lab.</p>
          </header>

          <ul className="lab-learn">
            {LEARN.map((item) => (
              <li key={item.slug} className="lab-learn-item">
                <button type="button" className="lab-learn-link" onClick={() => goToDocs(item.slug)}>
                  <span className="lab-learn-copy">
                    <span className="lab-learn-title">{item.title}</span>
                    <span className="lab-learn-text">{item.text}</span>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {wizard.open && (
        <Suspense fallback={null}>
          <LabNewProject
            workspaces={workspaces}
            mode={wizard.mode}
            initialTemplate={wizard.template}
            initialTarget={wizard.target}
            onClose={closeWizard}
            onCreate={handleCreateFromWizard}
          />
        </Suspense>
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          title="Delete workspace"
          description={
            <>
              This deletes the workspace <strong>{deleteTarget.name}</strong> and every file inside it.
              This cannot be undone.
            </>
          }
          confirmLabel="Delete workspace"
          busy={deleting}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={cancelDelete}
        />
      )}

      {toast && <SuccessToast message={toast} onClose={dismissToast} />}
    </div>
  );
}
