// LabPage.tsx — Lab home: start a project, reopen recent work, and manage workspaces and projects.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronRight, FileCode, Folder, Plus, Search, Trash2 } from 'lucide-react';
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

/** "Oct 21, 2026" from the ISO timestamps Turso stores. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

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
      <div className="lab-hero-wrapper page-hero-band is-full-bleed is-dot-grid">
        <div className="lab-hero-inner page-hero-inner">
          <div className="lab-hero-copy">
            <span className="page-hero-eyebrow">The Lab</span>
            <h1 className="page-hero-title">
              Write a strategy, then test it against real market history.
            </h1>
          </div>

          <div className="lab-hero-docs">
            <p className="lab-hero-docs-text">
              The Docs page lists every method you can override, with worked examples you can copy.
            </p>
            <button type="button" className="lab-docs-link" onClick={() => onNavigate?.('docs')}>
              Read the docs <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="lab-page">
        <aside className="lab-start" aria-label="Start">
          <section className="lab-card" aria-labelledby="lab-new-title">
            <p className="lab-eyebrow">New project</p>
            <h2 id="lab-new-title" className="lab-section-title">Build a strategy</h2>
            <p className="lab-card-text">
              Each project opens in its own editor, with the engine classes read-only and your code in workspace/.
            </p>
            <Button variant="primary" size="md" className="lab-full" onClick={() => startWizard()}>
              <Plus size={15} aria-hidden="true" /> New project
            </Button>
          </section>
        </aside>

        <div className="lab-workspace-panel">
          <section className="lab-card lab-ws" aria-labelledby="workspace-title">
            <header className="lab-ws-header">
              <h2 id="workspace-title" className="lab-ws-title">Workspaces</h2>
              <span className="lab-ws-meta">
                {workspaces.length} active workspace{workspaces.length === 1 ? '' : 's'} · {projectCount} project
                {projectCount === 1 ? '' : 's'}
              </span>
            </header>

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
              <Button variant="primary" size="sm" className="lab-ws-new" onClick={() => startWizard('blank', 'new')}>
                <Plus size={13} aria-hidden="true" /> New workspace
              </Button>
            </div>

            <div className="lab-ws-columns" aria-hidden="true">
              <span>Project</span>
              <span>Files</span>
              <span>Created</span>
              <span />
            </div>

            <ul className="lab-ws-list">
              {loading && (
                <li className="lab-ws-empty">
                  <LoaderScreen
                    label="Loading workspaces…"
                    sub="Reading your workspaces and projects from the account store."
                  />
                </li>
              )}

              {!loading && loadError && (
                <li className="lab-ws-empty">
                  <span className="lab-ws-empty-title">{loadError}</span>
                  <Button variant="secondary" size="sm" onClick={() => void loadWorkspaces()}>
                    Try again
                  </Button>
                </li>
              )}

              {!loading && !loadError && workspaces.length === 0 && (
                <li className="lab-ws-empty">
                  <span className="lab-ws-empty-title">No workspaces yet</span>
                  <span>Create a project to get started — it will show up here.</span>
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
                        <ChevronRight size={14} aria-hidden="true" className="lab-ws-caret" />
                        <Folder size={14} aria-hidden="true" className="lab-ws-folder" />
                        <span className="lab-ws-name"><Highlight text={ws.name} query={q} /></span>
                      </button>
                      <span className="lab-ws-badge">
                        {ws.projects.length} project{ws.projects.length === 1 ? '' : 's'}
                      </span>
                      <button
                        type="button"
                        className="lab-icon-button lab-icon-button-danger"
                        aria-label={`Delete workspace ${ws.name}`}
                        onClick={() => askDelete({ kind: 'workspace', id: ws.id, name: ws.name })}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>

                    {isOpen && (
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
                              <span className="lab-ws-cell">
                                {p.file_count ?? 0} file{(p.file_count ?? 0) === 1 ? '' : 's'}
                              </span>
                              <span className="lab-ws-cell">{formatDate(p.created_at)}</span>
                              <button
                                type="button"
                                className="lab-icon-button lab-icon-button-danger"
                                aria-label={`Delete project ${p.name}`}
                                onClick={() => askDelete({ kind: 'project', id: p.id, name: p.name })}
                              >
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
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
