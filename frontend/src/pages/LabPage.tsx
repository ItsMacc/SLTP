// LabPage.tsx — Lab home: a hero in the Home page's voice, the workspace
// panel, and the notes that explain what a run returns.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronRight, FileCode, Folder, Search, Trash2 } from 'lucide-react';
import { getSessionToken, getSessionUserId } from '../../lib/session';
import { readSession, sessionKeyFor, writeSession } from '../../lib/sessionCache';
import {
  createLabProject,
  createLabWorkspace,
  deleteLabProject,
  deleteLabWorkspace,
  listLabWorkspaces,
  type LabProject,
  type LabWorkspace,
} from '../../lib/api';
import type { LabTemplateId } from '../lab/templates';
import type { NewProjectInput } from './LabNewProject';
import Button from '../ui/Button';
import Select from '../ui/Select';
import ConfirmDeleteDialog from '../ui/ConfirmDeleteDialog';
import SuccessToast from '../ui/SuccessToast';
import { LoaderScreen } from '../ui/Loader';
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

/** "Oct 21, 2026" from the ISO timestamps Turso stores. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* The tab-scoped copy of the workspace list. Closing the tab drops it. */
const LAB_WORKSPACES_KEY = 'sltp_session_lab_workspaces';

/** "1 project" / "3 projects". */
function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** The workspace's own date, or its newest project's when that is later. */
function lastTouched(workspace: LabWorkspace): number {
  const times = [
    new Date(workspace.created_at).getTime(),
    ...workspace.projects.map((project) => new Date(project.created_at).getTime()),
  ].filter((time) => !Number.isNaN(time));
  return times.length ? Math.max(...times) : 0;
}

/** Every file in the workspace's projects. */
function filesIn(workspace: LabWorkspace): number {
  return workspace.projects.reduce((total, project) => total + (project.file_count ?? 0), 0);
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
  kind: 'workspace' | 'project';
  id: string;
  name: string;
};

interface LabPageProps {
  onNavigate?: (tab: string) => void;
}

export default function LabPage({ onNavigate }: LabPageProps) {
  const [openProject, setOpenProject] = useState<{ project: LabProject; workspaceName: string } | null>(null);
  const [wizard, setWizard] = useState<{ open: boolean; template: LabTemplateId; target: 'existing' | 'new' }>({
    open: false,
    template: 'blank',
    target: 'existing',
  });
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const closeWizard = useCallback(() => setWizard((w) => ({ ...w, open: false })), []);

  // Workspace panel state
  const [workspaces, setWorkspaces] = useState<LabWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // The tab-scoped copy of the workspace list. Closing the tab drops it.
  const workspacesKey = useCallback(async () => sessionKeyFor(LAB_WORKSPACES_KEY, await getSessionUserId()), []);

  // Reads the signed-in user's workspaces (and their projects) from Turso.
  // The tab copy paints first; the network then confirms or corrects it.
  const loadWorkspaces = useCallback(async () => {
    const key = await workspacesKey();
    const cached = readSession<LabWorkspace[]>(key);
    if (cached) {
      setWorkspaces(cached);
      setLoadError(null);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const token = await getSessionToken();
      const data = await listLabWorkspaces(token);
      setWorkspaces(data);
      writeSession(key, data);
      setLoadError(null);
    } catch (err) {
      // A failed revalidation keeps the tab copy on screen rather than
      // blanking a working panel. A first load with no copy shows the error.
      if (!cached) setLoadError(err instanceof Error ? err.message : 'Could not load your workspaces.');
    } finally {
      setLoading(false);
    }
  }, [workspacesKey]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  const q = query.trim().toLowerCase();

  const orderedWorkspaces = useMemo(() => {
    const next = [...workspaces];
    next.sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : lastTouched(b) - lastTouched(a),
    );
    return next;
  }, [workspaces, sort]);

  const visibleWorkspaces = useMemo(() => {
    if (!q) return orderedWorkspaces;
    return orderedWorkspaces.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.projects.some((p) => p.name.toLowerCase().includes(q)),
    );
  }, [orderedWorkspaces, q]);

  const projectCount = workspaces.reduce((n, w) => n + w.projects.length, 0);
  const fileCount = workspaces.reduce((n, w) => n + filesIn(w), 0);
  const panelState = loading ? 'loading' : loadError ? 'error' : 'ready';

  const toggleWorkspace = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openInEditor = (project: LabProject, workspaceName: string) => {
    setOpenProject({ project, workspaceName });
  };

  const startWizard = (template: LabTemplateId = 'blank', target: 'existing' | 'new' = 'existing') => {
    setWizard({ open: true, template, target });
  };

  /* Docs keeps its current page in the hash, so setting it before switching
     tabs is what opens a specific page rather than the first one. */
  const goToDocs = (slug?: string) => {
    if (slug) window.location.hash = `#/docs/${slug}`;
    onNavigate?.('docs');
  };

  // The wizard reports the target workspace: an existing one (by id) or a brand
  // new one (by name). Either way the project is persisted in Turso.
  const handleCreateFromWizard = async (input: NewProjectInput) => {
    const token = await getSessionToken();

    let project: LabProject;
    if (input.workspaceId) {
      project = await createLabProject(token, input.workspaceId, input.projectName, input.template);
    } else {
      const workspace = await createLabWorkspace(token, {
        workspace_name: input.workspaceName,
        project_name: input.projectName,
        template: input.template,
      });
      const created = workspace.projects[0];
      if (!created) throw new Error('The workspace was created but no project came back.');
      project = created;
    }

    setWizard((w) => ({ ...w, open: false }));
    await loadWorkspaces();
    openInEditor(project, input.workspaceName);
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
      const token = await getSessionToken();
      if (deleteTarget.kind === 'workspace') {
        await deleteLabWorkspace(token, deleteTarget.id);
      } else {
        await deleteLabProject(token, deleteTarget.id);
      }
      setDeleteTarget(null);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (deleteTarget.kind === 'workspace') next.delete(deleteTarget.id);
        return next;
      });
      await loadWorkspaces();
      setToast(
        deleteTarget.kind === 'workspace'
          ? `Workspace “${deleteTarget.name}” deleted`
          : `Project “${deleteTarget.name}” deleted`,
      );
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete.');
    } finally {
      setDeleting(false);
    }
  };

  if (openProject) {
    return (
      <Suspense
        fallback={
          <div className="lab-opening">
            <LoaderScreen label="Opening project…" sub="Loading the editor." />
          </div>
        }
      >
        {/* Keyed by project: drafts, tabs and the VFS belong to one project,
            so opening another always starts from a clean mount. */}
        <LabEditorPage
          key={openProject.project.id}
          project={openProject.project}
          workspaceName={openProject.workspaceName}
          onBack={() => {
            setOpenProject(null);
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
            A Python-based backtesting engine for your own strategies.
            {/* The sentence break is the natural one at this size: without it the
                balance puts "Test" at the end of the first line. Hidden on narrow
                screens, where the headline wraps on its own. */}
            <br className="lab-hero-break" />{' '}
          </h1>

          <p className="lab-hero-lede">
            The engine handles the trading rules for you, so you can focus on your strategy. See how your ideas perform under real market conditions without writing boilerplate infrastructure.
          </p>

          <div className="lab-hero-actions">
            <Button variant="primary" size="lg" className="lab-hero-new" onClick={() => startWizard()}>
              New project
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
            <h2 id="workspace-title" className="lab-ws-title">Workspaces</h2>
            <span className="lab-ws-count">
              {plural(workspaces.length, 'workspace')}, {plural(projectCount, 'project')}
            </span>
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
                  placeholder="Search workspaces and projects"
                  aria-label="Search workspaces and projects"
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
                  onClick={() => startWizard('blank', 'new')}
                >
                  New workspace
                </Button>
              </div>
            </div>

            <div className="lab-ws-scroll">
              <div className="lab-ws-columns" aria-hidden="true">
                <span className="is-name">Name</span>
                <span className="is-projects">Projects</span>
                <span className="is-files">Files</span>
                <span className="is-created">Created</span>
                <span />
              </div>

              <ul className="lab-ws-list" data-lab-state={panelState} aria-busy={loading}>
                {loading &&
                  [0, 1, 2].map((row) => (
                    <li key={row} className="lab-ws-skeleton" aria-hidden="true">
                      <span className="lab-skel is-name" />
                      <span className="lab-skel is-projects" />
                      <span className="lab-skel is-files" />
                      <span className="lab-skel is-created" />
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
                    <span>Create a project and it will appear here.</span>
                    <Button
                      variant="primary"
                      size="sm"
                      className="lab-ws-state-action"
                      onClick={() => startWizard()}
                    >
                      New project
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
                    const isOpen =
                      expanded.has(ws.id) ||
                      (q !== '' && ws.projects.some((p) => p.name.toLowerCase().includes(q)));
                    return (
                      <li key={ws.id} className={`lab-ws-group${isOpen ? ' is-expanded' : ''}`}>
                        <div className="lab-ws-row" data-projects={ws.projects.length}>
                          <button
                            type="button"
                            className="lab-ws-row-main"
                            onClick={() => toggleWorkspace(ws.id)}
                            aria-expanded={isOpen}
                          >
                            <ChevronRight size={14} aria-hidden="true" className="lab-ws-caret" />
                            <span className="lab-ws-folder" aria-hidden="true">
                              <Folder size={14} />
                            </span>
                            <span className="lab-ws-name-wrap">
                              <span className="lab-ws-name"><Highlight text={ws.name} query={q} /></span>
                              <span className="lab-ws-badge">{plural(ws.projects.length, 'project')}</span>
                            </span>
                          </button>

                          <span className="lab-ws-cell is-projects">{ws.projects.length}</span>
                          <span className="lab-ws-cell is-files">{filesIn(ws)}</span>
                          <span className="lab-ws-cell is-created">{formatDate(ws.created_at)}</span>

                          <span className="lab-ws-actions">
                            <Button
                              variant="danger"
                              size="icon"
                              className="lab-icon-button lab-icon-button-danger"
                              aria-label={`Delete workspace ${ws.name}`}
                              onClick={() => askDelete({ kind: 'workspace', id: ws.id, name: ws.name })}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </Button>
                          </span>
                        </div>

                        {/* Always mounted so closing animates too. Visibility
                            removes a closed list from the tab order. */}
                        <div className={`lab-ws-fold${isOpen ? ' is-open' : ''}`}>
                          <div className="lab-ws-fold-inner">
                            <ul className="lab-ws-projects">
                              {ws.projects.length === 0 && (
                                <li className="lab-ws-state is-inline">
                                  No projects in this workspace yet.
                                </li>
                              )}
                              {ws.projects.map((p) => (
                                <li key={p.id}>
                                  <div className="lab-ws-project">
                                    <button
                                      type="button"
                                      className="lab-ws-project-open"
                                      onClick={() => openInEditor(p, ws.name)}
                                    >
                                      <FileCode size={14} aria-hidden="true" />
                                      <span><Highlight text={p.name} query={q} /></span>
                                    </button>
                                    <span className="lab-ws-cell is-projects" />
                                    <span className="lab-ws-cell is-files">{p.file_count ?? 0}</span>
                                    <span className="lab-ws-cell is-created">{formatDate(p.created_at)}</span>
                                    <span className="lab-ws-actions">
                                      <button
                                        type="button"
                                        className="lab-ws-open"
                                        onClick={() => openInEditor(p, ws.name)}
                                      >
                                        Open
                                      </button>
                                      <Button
                                        variant="danger"
                                        size="icon"
                                        className="lab-icon-button lab-icon-button-danger"
                                        aria-label={`Delete project ${p.name}`}
                                        onClick={() => askDelete({ kind: 'project', id: p.id, name: p.name })}
                                      >
                                        <Trash2 size={14} aria-hidden="true" />
                                      </Button>
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>

            <div className="lab-ws-footer">
              {q
                ? `Showing ${visibleWorkspaces.length} of ${plural(workspaces.length, 'workspace')}`
                : `${plural(workspaces.length, 'workspace')} · ${plural(projectCount, 'project')} · ${plural(fileCount, 'file')}`}
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
            initialTemplate={wizard.template}
            initialTarget={wizard.target}
            onClose={closeWizard}
            onCreate={handleCreateFromWizard}
          />
        </Suspense>
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          title={deleteTarget.kind === 'workspace' ? 'Delete workspace' : 'Delete project'}
          description={
            deleteTarget.kind === 'workspace' ? (
              <>
                This deletes the workspace <strong>{deleteTarget.name}</strong> and every project inside it.
                This cannot be undone.
              </>
            ) : (
              <>
                This deletes the project <strong>{deleteTarget.name}</strong> and all of its files.
                This cannot be undone.
              </>
            )
          }
          confirmLabel={deleteTarget.kind === 'workspace' ? 'Delete workspace' : 'Delete project'}
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
