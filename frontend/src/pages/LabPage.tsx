// LabPage.tsx — Lab home: a hero in the Home page's voice, the workspace
// table, and the notes that explain how a project runs.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronRight, FileCode, Search, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
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
import ConfirmDeleteDialog from '../ui/ConfirmDeleteDialog';
import SuccessToast from '../ui/SuccessToast';
import { LoaderScreen } from '../ui/Loader';
import './LabPage.css';

const LabEditorPage = lazy(() => import('./LabEditorPage'));
const LabNewProject = lazy(() => import('./LabNewProject'));

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

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
 * A browser network failure says nothing a reader can act on, so it becomes a
 * sentence they can. Anything the API said itself is passed through.
 */
function describeLoadError(message: string): string {
  const fallback = 'Could not load your workspaces. Check your connection and try again.';
  const raw = message.trim();
  if (!raw) return fallback;
  const browserLevel = ['failed to fetch', 'load failed', 'networkerror', 'network error', 'fetch failed'];
  if (browserLevel.some((phrase) => raw.toLowerCase().includes(phrase))) return fallback;
  return raw;
}

/** "Oct 21, 2026" from the ISO timestamps Turso stores. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ---------- Rules the engine applies for you ---------- */
const FACTS: { title: string; text: string }[] = [
  {
    title: 'Next-open fills',
    text: "A signal after Monday's close fills at Tuesday's open.",
  },
  {
    title: 'Trading costs',
    text: 'Every fill pays 0.05% slippage and a 0.1% fee. Do not add your own on top.',
  },
  {
    title: 'Cautious exits',
    text: 'If one day touches both your stop and your target, the stop wins. A gap fills at the open.',
  },
  {
    title: 'No lookahead',
    text: 'Your code only sees bars up to and including today.',
  },
  {
    title: 'Long and short',
    text: 'Orders can go either way. Total exposure cannot exceed your equity.',
  },
  {
    title: 'Position limits',
    text: 'Cap the number of positions, lots per ticker and allocation per ticker.',
  },
];

/* ---------- What a run returns ---------- */
const METRICS: { name: string; note: string }[] = [
  { name: 'CAGR', note: 'Yearly growth rate' },
  { name: 'Sharpe ratio', note: 'Return per unit of risk' },
  { name: 'Sortino ratio', note: 'Return per unit of downside risk' },
  {
    name: 'Probabilistic Sharpe',
    note: 'Chance the Sharpe beats 1.0, adjusted for skew and sample size',
  },
  { name: 'Max drawdown', note: 'Largest fall from a peak' },
  { name: 'Win rate', note: 'Share of closed trades that made money' },
  { name: 'Expectancy', note: 'Average return per closed trade' },
  { name: 'Unrealized profit', note: 'Open profit on the last day' },
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

  // Reads the signed-in user's workspaces (and their projects) from Turso.
  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const data = await listLabWorkspaces(token);
      setWorkspaces(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your workspaces.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  const q = query.trim().toLowerCase();

  const visibleWorkspaces = useMemo(() => {
    if (!q) return workspaces;
    return workspaces.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.projects.some((p) => p.name.toLowerCase().includes(q)),
    );
  }, [workspaces, q]);

  const projectCount = workspaces.reduce((n, w) => n + w.projects.length, 0);

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
    const token = await getToken();
    if (!token) throw new Error('Your session has expired. Please sign in again.');

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
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
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
        <LabEditorPage
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
            <Button variant="primary" size="lg" onClick={() => startWizard()}>
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
              {workspaces.length} workspace{workspaces.length === 1 ? '' : 's'}, {projectCount} project
              {projectCount === 1 ? '' : 's'}
            </span>
          </div>

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
            <Button variant="secondary" size="sm" className="lab-ws-new" onClick={() => startWizard('blank', 'new')}>
              New workspace
            </Button>
          </div>

          <div className="lab-ws-scroll">
            <div className="lab-ws-columns" aria-hidden="true">
              <span>Project</span>
              <span className="lab-ws-col is-files">Files</span>
              <span className="lab-ws-col is-created">Created</span>
              <span />
            </div>

            <ul className="lab-ws-list">
              {loading && (
                <li className="lab-ws-empty">Loading workspaces…</li>
              )}

              {!loading && loadError && (
                <li className="lab-ws-empty">
                  <span>{describeLoadError(loadError)}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="lab-ws-retry"
                    onClick={() => void loadWorkspaces()}
                  >
                    Try again
                  </Button>
                </li>
              )}

              {!loading && !loadError && workspaces.length === 0 && (
                <li className="lab-ws-empty">
                  <span className="lab-ws-empty-title">No workspaces yet.</span>
                  <span>Create a project and it will appear here.</span>
                </li>
              )}

              {!loading && !loadError && workspaces.length > 0 && visibleWorkspaces.length === 0 && (
                <li className="lab-ws-empty">No workspaces match “{query.trim()}”.</li>
              )}

              {visibleWorkspaces.map((ws) => {
                const isOpen =
                  expanded.has(ws.id) || (q !== '' && ws.projects.some((p) => p.name.toLowerCase().includes(q)));
                return (
                  <li key={ws.id} className={`lab-ws-group${isOpen ? ' is-expanded' : ''}`}>
                    <div className="lab-ws-row">
                      <button
                        type="button"
                        className="lab-ws-row-main"
                        onClick={() => toggleWorkspace(ws.id)}
                        aria-expanded={isOpen}
                      >
                        <span className="lab-ws-name"><Highlight text={ws.name} query={q} /></span>
                        <span className="lab-ws-badge">
                          {ws.projects.length} project{ws.projects.length === 1 ? '' : 's'}
                        </span>
                        <ChevronRight size={14} aria-hidden="true" className="lab-ws-caret" />
                      </button>
                      <Button
                        variant="danger"
                        size="icon"
                        className="lab-icon-button lab-icon-button-danger"
                        aria-label={`Delete workspace ${ws.name}`}
                        onClick={() => askDelete({ kind: 'workspace', id: ws.id, name: ws.name })}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    </div>

                    {/* Always mounted so closing animates too. Visibility
                        removes a closed list from the tab order. */}
                    <div className={`lab-ws-fold${isOpen ? ' is-open' : ''}`}>
                      <div className="lab-ws-fold-inner">
                        <ul className="lab-ws-strategies">
                          {ws.projects.length === 0 && (
                            <li className="lab-ws-empty">No projects in this workspace yet.</li>
                          )}
                          {ws.projects.map((p) => (
                            <li key={p.id}>
                              <div className="lab-ws-strategy">
                                <button
                                  type="button"
                                  className="lab-ws-strategy-open"
                                  onClick={() => openInEditor(p, ws.name)}
                                >
                                  <span className="lab-ws-strategy-name">
                                    <FileCode size={14} aria-hidden="true" />
                                    <span><Highlight text={p.name} query={q} /></span>
                                  </span>
                                </button>
                                <span className="lab-ws-cell is-files">
                                  {p.file_count ?? 0} file{(p.file_count ?? 0) === 1 ? '' : 's'}
                                </span>
                                <span className="lab-ws-cell is-created">{formatDate(p.created_at)}</span>
                                <Button
                                  variant="danger"
                                  size="icon"
                                  className="lab-icon-button lab-icon-button-danger"
                                  aria-label={`Delete project ${p.name}`}
                                  onClick={() => askDelete({ kind: 'project', id: p.id, name: p.name })}
                                >
                                  <Trash2 size={14} aria-hidden="true" />
                                </Button>
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
        </section>

        <section className="lab-section" aria-labelledby="lab-results">
          <header className="lab-section-head">
            <h2 id="lab-results" className="lab-section-title">What each run returns</h2>
            <p className="lab-section-lede">
              Equity starts at 100, so a value of 112 means the book is up 12%.
            </p>
          </header>

          <div className="lab-results">
            <dl className="lab-metrics">
              {METRICS.map((metric) => (
                <div key={metric.name} className="lab-metric">
                  <dt className="lab-metric-name">{metric.name}</dt>
                  <dd className="lab-metric-note">{metric.note}</dd>
                </div>
              ))}
            </dl>

            <p className="lab-results-note">
              You also get every trade with its entry, exit and exit reason, a daily equity curve,
              and a count of orders the engine rejected and why.
            </p>
          </div>
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
