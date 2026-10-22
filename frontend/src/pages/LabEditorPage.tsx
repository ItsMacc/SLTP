// LabEditorPage.tsx — Lab project editor. A dark IDE frame with a file tree, tabs, a Monaco
// editor checked live by Pyright (in a Web Worker), and a terminal.
//
// A project has two packages:
//   core/       the read-only engine (Strategy, PortfolioManager, StockData,
//               StrategyDecision), mirrored from the repo and never editable
//   workspace/  the files the student writes
//
// The tree is built from the files themselves, so a folder is only shown when
// a real file lives in it. Nothing is executed in the browser: the project runs
// in a container on the server, so Run is a placeholder for now.
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type ReactNode,
} from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronRight,
  FileCode,
  Folder,
  FolderInput,
  Lock,
  Pencil,
  Play,
  Plus,
  Save,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { supabase } from '../../lib/supabase';
import {
  createLabFile,
  deleteLabFile,
  deleteLabFolder,
  getLabProjectFiles,
  importLabFiles,
  renameLabFile,
  saveLabFile,
  type LabProject,
} from '../../lib/api';
import { loadProject, setDiagnosticsTarget, syncDocument, type Monaco } from '../lab/pyright';
import { applyLabEditorTheme } from '../lab/editorTheme';
import { pickLocalFolder, type FolderFileMap } from '../lab/fileReader';
import ImportFolderDialog from '../lab/ImportFolderDialog';
import Button from '../ui/Button';
import SuccessToast from '../ui/SuccessToast';
import { LoaderInline, LoaderOverlay, LoaderScreen } from '../ui/Loader';
import './LabEditorPage.css';

const FILE_NAME_RE = /^(?:[A-Za-z0-9_-]{1,50}\/)*[A-Za-z0-9_-]{1,50}\.py$/;
// The two packages every project is built from.
const CORE_FOLDER = 'core';
const WORKSPACE_FOLDER = 'workspace';
const TOP_FOLDERS = [CORE_FOLDER, WORKSPACE_FOLDER];
const isCorePath = (path: string) => path === CORE_FOLDER || path.startsWith(`${CORE_FOLDER}/`);
// Everything the student writes belongs in the workspace.
const inWorkspace = (name: string) => `${WORKSPACE_FOLDER}/${name.replace(/^\/+/, '')}`;
const basename = (name: string) => name.split('/').at(-1) ?? name;
// The path of a file inside its folder, used to place it in the tree.
const parentPath = (name: string) => name.split('/').slice(0, -1).join('/');
// core/ is listed before workspace/, so the read-only package reads first.
const folderRank = (path: string) => {
  const index = TOP_FOLDERS.indexOf(path.split('/')[0]);
  return index === -1 ? TOP_FOLDERS.length : index;
};
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 420;
const SIDEBAR_DEFAULT = 232;
const STUB_REBUILD_DELAY_MS = 700;

interface EditorFile {
  name: string;
  locked: boolean;
  saved: string;
  draft: string;
}

interface TreeNode {
  path: string;
  files: EditorFile[];
  children: string[];
}

// The folder tree a project shows. Every folder is implied by a file that
// lives in it, so the tree never shows a folder that is not really there.
function buildTree(files: EditorFile[]): Map<string, TreeNode> {
  const nodes = new Map<string, TreeNode>();
  const ensure = (path: string) => {
    const parts = path.split('/');
    for (let index = 1; index <= parts.length; index += 1) {
      const prefix = parts.slice(0, index).join('/');
      if (!nodes.has(prefix)) nodes.set(prefix, { path: prefix, files: [], children: [] });
    }
  };

  for (const file of files) {
    const parent = parentPath(file.name);
    if (parent) ensure(parent);
  }
  for (const file of files) {
    const parent = parentPath(file.name);
    if (!parent) continue;
    nodes.get(parent)?.files.push(file);
  }
  for (const node of nodes.values()) {
    const parent = parentPath(node.path);
    const parentNode = nodes.get(parent);
    if (parentNode) parentNode.children.push(node.path);
  }

  for (const node of nodes.values()) {
    node.children.sort((a, b) => folderRank(a) - folderRank(b) || a.localeCompare(b));
    node.files.sort((a, b) => a.name.localeCompare(b.name));
  }
  return nodes;
}

interface OutputLine {
  id: number;
  kind: 'command' | 'stdout' | 'stderr' | 'info';
  text: string;
}

type PyrightState = 'starting' | 'active' | 'failed';

interface LabEditorPageProps {
  project: LabProject;
  workspaceName: string;
  onBack: () => void;
}

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function isDirty(file: EditorFile): boolean {
  return !file.locked && file.draft !== file.saved;
}

const PYRIGHT_LABEL: Record<PyrightState, string> = {
  starting: 'Pyright starting…',
  active: 'Pyright active',
  failed: 'Pyright unavailable',
};

const RUN_LABEL = 'Runner offline';

export default function LabEditorPage({ project, workspaceName, onBack }: LabEditorPageProps) {
  const [files, setFiles] = useState<EditorFile[]>([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set<string>(TOP_FOLDERS));
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const projectFilesQuery = useQuery({
    queryKey: ['lab', 'project-files', project.id],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      return getLabProjectFiles(token, project.id);
    },
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? (projectFilesQuery.error instanceof Error
    ? projectFilesQuery.error.message
    : projectFilesQuery.error ? 'Could not load the project files.' : null);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const newFileInputRef = useRef<HTMLInputElement>(null);
  // The folder the browser read off disk, waiting for the user to confirm it.
  const [pendingImport, setPendingImport] = useState<FolderFileMap | null>(null);
  const [readingFolder, setReadingFolder] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState< { from: string; value: string } | null>(null);
  const deletingRef = useRef(false);
  // The file or folder currently being removed from the project store.
  const [deletingTarget, setDeletingTarget] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  // The file currently being written to the project store, if any.
  const [savingFile, setSavingFile] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const [pyright, setPyright] = useState<PyrightState>('starting');
  const [editorReady, setEditorReady] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs' | 'vs-dark'>(() => {
    const saved = sessionStorage.getItem('st_user_theme')?.toLowerCase();
    const theme = document.documentElement.getAttribute('data-theme')?.toLowerCase() ?? saved;
    return theme === 'dark' ? 'vs-dark' : 'vs';
  });
  const [markerCounts, setMarkerCounts] = useState({ errors: 0, warnings: 0 });
  // The cursor readout lives in its own component, so moving the cursor does not re-render the page.
  const cursorListenerRef = useRef<((position: { line: number; column: number }) => void) | null>(null);

  const [terminalOpen, setTerminalOpen] = useState(true);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const clearOutput = useCallback(() => setOutput([]), []);
  const closeTerminal = useCallback(() => setTerminalOpen(false), []);

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const lineIdRef = useRef(0);

  // Monaco registers its keybindings once, so they read the latest handlers through these refs.
  const saveActiveRef = useRef<() => void>(() => {});
  const runActiveRef = useRef<() => void>(() => {});

  // Keep the editor in sync with the site theme, including preference changes while open.
  useEffect(() => {
    const syncEditorTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme')?.toLowerCase();
      setEditorTheme(theme === 'dark' ? 'vs-dark' : 'vs');
    };
    syncEditorTheme();
    const observer = new MutationObserver(syncEditorTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Opening a project should start at the top of the page, not at wherever the list was scrolled.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  const latestFilesRef = useRef(files);
  useEffect(() => {
    latestFilesRef.current = files;
  }, [files]);

  useEffect(() => {
    const data = projectFilesQuery.data;
    if (!data) return;
    const list: EditorFile[] = data.files.map((file) => {
      const previous = latestFilesRef.current.find((item) => item.name === file.name);
      return { name: file.name, locked: file.locked, saved: file.content, draft: previous?.draft ?? file.content };
    });
    // The first editable file opens; the read-only core is there to read, not to edit.
    const first = list.find((file) => !file.locked)?.name ?? list[0]?.name ?? null;
    setFiles(list);
    // The two packages start open; deeper folders stay as the user left them.
    setExpandedFolders((previous) => new Set([...previous, ...TOP_FOLDERS]));
    setTabs((previous) => previous.length ? previous.filter((name) => list.some((file) => file.name === name)) : first ? [first] : []);
    setActive((previous) => previous && list.some((file) => file.name === previous) ? previous : first);
  // Keep unsaved drafts local; reconcile only when the cache snapshot changes.
  }, [projectFilesQuery.data]);

  useEffect(() => {
    if (newFileOpen) newFileInputRef.current?.focus();
  }, [newFileOpen]);

  const loading = projectFilesQuery.isPending && files.length === 0;
  const dirtyCount = files.filter(isDirty).length;
  const activeFile = files.find((f) => f.name === active) ?? null;

  const openFile = (name: string) => {
    setTabs((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setActive(name);
  };

  const closeTab = (name: string) => {
    const idx = tabs.indexOf(name);
    const next = tabs.filter((t) => t !== name);
    setTabs(next);
    if (active === name) setActive(next[Math.max(0, idx - 1)] ?? null);
  };

  const updateProjectCache = useCallback((update: (current: Awaited<ReturnType<typeof getLabProjectFiles>>) => Awaited<ReturnType<typeof getLabProjectFiles>>) => {
    queryClient.setQueryData<Awaited<ReturnType<typeof getLabProjectFiles>>>(
      ['lab', 'project-files', project.id],
      (current) => current ? update(current) : current,
    );
  }, [project.id, queryClient]);

  const saveFile = async (name: string) => {
    const file = files.find((f) => f.name === name);
    if (!file || !isDirty(file)) return;
    const draft = file.draft;
    setActionError(null);
    setSavingFile(name);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      await saveLabFile(token, project.id, name, draft);
      setFiles((prev) => prev.map((f) => (f.name === name ? { ...f, saved: draft } : f)));
      updateProjectCache((current) => ({
        ...current,
        files: current.files.map((file) => file.name === name ? { ...file, content: draft } : file),
      }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Could not save ${name}.`);
    } finally {
      setSavingFile((current) => (current === name ? null : current));
    }
  };

  // -------- Pyright: live diagnostics --------

  const refreshMarkerCounts = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!monaco || !model) return;
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    setMarkerCounts({
      errors: markers.filter((m) => m.severity === monaco.MarkerSeverity.Error).length,
      warnings: markers.filter((m) => m.severity === monaco.MarkerSeverity.Warning).length,
    });
  }, []);

  // Points diagnostics at the shown model and sends its text to Pyright.
  const bindActiveModel = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;
    setDiagnosticsTarget({ monaco, model });
    void syncDocument(editor.getValue());
    refreshMarkerCounts();
  }, [refreshMarkerCounts]);

  // Each switch of the shown file rebinds diagnostics to that file.
  useEffect(() => {
    if (pyright === 'active') bindActiveModel();
  }, [active, pyright, bindActiveModel]);

  // Each file's saved text becomes a stub, so `from core.strategy.strategy import Strategy`
  // resolves to the project's own core package. Stubs are fixed when a worker starts, so it is
  // rebuilt when a file is saved, created, renamed or deleted. Unsaved drafts do not trigger
  // a rebuild.
  const stubKey = files.map((f) => `${f.name}\u0000${f.saved}`).join('\u0001');
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!editorReady || loading || !monaco) return;
    const stubs: Record<string, string> = {};
    for (const f of latestFilesRef.current) stubs[f.name] = f.saved;
    const timer = window.setTimeout(() => {
      loadProject(monaco, stubs)
        .then(() => {
          setPyright('active');
          bindActiveModel();
        })
        .catch(() => setPyright('failed'));
    }, STUB_REBUILD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [stubKey, editorReady, loading, bindActiveModel]);

  const handleMount: OnMount = (editor, monacoInstance) => {
    const monaco = monacoInstance as Monaco;
    applyLabEditorTheme(monaco, editorTheme);
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveActiveRef.current());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runActiveRef.current());
    editor.onDidChangeCursorPosition((e) => {
      cursorListenerRef.current?.({ line: e.position.lineNumber, column: e.position.column });
    });

    const markerSub = monaco.editor.onDidChangeMarkers((uris) => {
      const model = editor.getModel();
      if (model && uris.some((uri) => uri.toString() === model.uri.toString())) refreshMarkerCounts();
    });
    editor.onDidDispose(() => {
      markerSub.dispose();
      setDiagnosticsTarget(null);
    });

    setEditorReady(true);
  };

  useEffect(() => {
    const monaco = monacoRef.current;
    if (monaco) applyLabEditorTheme(monaco, editorTheme);
  }, [editorTheme]);

  // Moves the cursor to the next error in the open file, wrapping at the end.
  const jumpToNextError = () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;
    const errors = monaco.editor
      .getModelMarkers({ resource: model.uri })
      .filter((m) => m.severity === monaco.MarkerSeverity.Error)
      .sort((a, b) => a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn);
    if (errors.length === 0) return;
    const currentLine = editor.getPosition()?.lineNumber ?? 0;
    const next = errors.find((m) => m.startLineNumber > currentLine) ?? errors[0];
    editor.setPosition({ lineNumber: next.startLineNumber, column: next.startColumn });
    editor.revealLineInCenter(next.startLineNumber);
    editor.focus();
  };

  // -------- Run --------
  // A project runs in a container on the server, not in the browser. The button
  // is wired up, but there is no runner to talk to yet, so it says what is
  // going to happen instead of pretending to execute anything.

  const appendLine = (kind: OutputLine['kind'], text: string) => {
    lineIdRef.current += 1;
    const id = lineIdRef.current;
    setOutput((prev) => [...prev.slice(-1999), { id, kind, text }]);
  };

  const runActive = () => {
    if (!activeFile) return;
    setTerminalOpen(true);
    appendLine('command', `$ python ${activeFile.name}`);
    appendLine('info', 'Runs on the server. The runner is not connected yet, so nothing was executed.');
  };

  // The shortcut handler reads the latest closure through this ref.
  useEffect(() => {
    saveActiveRef.current = () => {
      if (active) void saveFile(active);
    };
    runActiveRef.current = runActive;
  });

  // -------- Layout --------

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMove = (ev: PointerEvent) => {
      const next = startWidth + ev.clientX - startX;
      setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, next)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleResizeKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.shiftKey ? 32 : 8;
    const delta = e.key === 'ArrowRight' ? step : -step;
    setSidebarWidth((w) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w + delta)));
  };

  // -------- File operations --------

  const closeNewFile = () => {
    setNewFileOpen(false);
    setNewName('');
    setActionError(null);
  };

  const deleteFolder = async (name: string) => {
    // The engine package is not ours to delete.
    if (isCorePath(name) || deletingRef.current) return;
    deletingRef.current = true;
    setDeletingTarget(name);
    setActionError(null);
    const beforeFiles = files;
    const prefix = `${name}/`;
    const removed = new Set(files.filter((file) => file.name.startsWith(prefix)).map((file) => file.name));
    const optimisticFiles = files.filter((file) => !removed.has(file.name));
    setFiles(optimisticFiles);
    updateProjectCache((current) => ({
      ...current,
      files: current.files.filter((file) => !removed.has(file.name)),
    }));
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      await deleteLabFolder(token, project.id, name);
      const nextTabs = tabs.filter((tab) => !removed.has(tab));
      setTabs(nextTabs);
      if (active && removed.has(active)) setActive(nextTabs[0] ?? null);
      setToast(`Deleted folder ${name} and its contents`);
    } catch (err) {
      setFiles(beforeFiles);
      updateProjectCache((current) => ({
        ...current,
        files: beforeFiles.map((before) => ({ name: before.name, content: before.saved, locked: before.locked })),
      }));
      setActionError(err instanceof Error ? err.message : `Could not delete ${name}.`);
    } finally {
      setDeletingTarget((current) => (current === name ? null : current));
      deletingRef.current = false;
    }
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = newName.trim();
    if (!raw) return;
    // Everything the student writes belongs in the workspace.
    const name = inWorkspace(/\.py$/.test(raw) ? raw : `${raw}.py`);
    if (!FILE_NAME_RE.test(name)) {
      setActionError('Use a path like helpers/signals.py; each part may use letters, numbers, _ or -.');
      return;
    }
    setActionError(null);
    setCreating(true);
    const optimisticFile: EditorFile = { name, locked: false, saved: '', draft: '' };
    setFiles((previous) => [...previous, optimisticFile]);
    openFile(name);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const file = await createLabFile(token, project.id, name);
      setFiles((previous) => previous.map((item) => item.name === name ? { ...item, name: file.name } : item));
      updateProjectCache((current) => ({ ...current, files: current.files.map((item) => item.name === name ? file : item) }));
      closeNewFile();
    } catch (err) {
      setFiles((previous) => previous.filter((item) => item.name !== name));
      updateProjectCache((current) => ({
        ...current,
        files: current.files.filter((item) => item.name !== name),
      }));
      setTabs((previous) => previous.filter((tab) => tab !== name));
      setActive((previous) => previous === name ? null : previous);
      setActionError(err instanceof Error ? err.message : 'Could not create the file.');
    } finally {
      setCreating(false);
    }
  };

  // -------- Import --------
  // The browser reads a real folder off this computer. Nothing is written to
  // the project until the user has seen the list of files and confirmed it.

  const handleImport = async () => {
    setActionError(null);
    setImportError(null);
    setReadingFolder(true);
    try {
      const map = await pickLocalFolder();
      if (!map) return;
      const count = Object.keys(map.files).length;
      if (count === 0) {
        setActionError(map.skipped.length
          ? `No Python files in ${map.root}. ${map.skipped.length} file(s) were left out.`
          : `No Python files in ${map.root}.`);
        return;
      }
      setPendingImport(map);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not read that folder.');
    } finally {
      setReadingFolder(false);
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    setImportBusy(true);
    setImportError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const entries = Object.entries(pendingImport.files).map(([path, content]) => ({ path, content }));
      const result = await importLabFiles(token, project.id, entries, pendingImport.folders);
      await queryClient.invalidateQueries({ queryKey: ['lab', 'project-files', project.id] });
      setPendingImport(null);
      const count = result.imported.length;
      setToast(`Imported ${count} ${count === 1 ? 'file' : 'files'} into ${WORKSPACE_FOLDER}/`);
      if (result.skipped.length) {
        setActionError(`${result.skipped.length} file(s) were left out. ${result.skipped[0].reason}`);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not import those files.');
    } finally {
      setImportBusy(false);
    }
  };

  const startRename = (name: string) => {
    setActionError(null);
    // The name is shown without the workspace/ prefix, because that is where
    // the file already lives and the prefix cannot be changed.
    setRenaming({ from: name, value: name.slice(`${WORKSPACE_FOLDER}/`.length) });
  };

  const commitRename = async () => {
    if (!renaming) return;
    const from = renaming.from;
    const raw = renaming.value.trim();
    const to = inWorkspace(/\.py$/.test(raw) ? raw : `${raw}.py`);
    if (to === from) {
      setRenaming(null);
      return;
    }
    if (!FILE_NAME_RE.test(to)) {
      setActionError('Use a path like helpers/signals.py; each part may use letters, numbers, _ or -.');
      return;
    }
    setActionError(null);
    setFileBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      setFiles((prev) => prev.map((file) => file.name === from ? { ...file, name: to } : file));
      setTabs((prev) => prev.map((tab) => tab === from ? to : tab));
      setActive((current) => current === from ? to : current);
      updateProjectCache((current) => ({
        ...current,
        files: current.files.map((file) => file.name === from ? { ...file, name: to } : file),
      }));
      const result = await renameLabFile(token, project.id, from, to);
      setFiles((prev) => prev.map((f) => (f.name === to ? { ...f, name: result.name } : f)));
      updateProjectCache((current) => ({
        ...current,
        files: current.files.map((file) => file.name === from ? { ...file, name: result.name } : file),
      }));
      setTabs((prev) => prev.map((t) => (t === to ? result.name : t)));
      setActive((a) => (a === to ? result.name : a));
      setRenaming(null);
      setToast(`Renamed ${from} to ${result.name}`);
    } catch (err) {
      setFiles((prev) => prev.map((file) => file.name === to ? { ...file, name: from } : file));
      setTabs((prev) => prev.map((tab) => tab === to ? from : tab));
      setActive((current) => current === to ? from : current);
      updateProjectCache((current) => ({
        ...current,
        files: current.files.map((file) => file.name === to ? { ...file, name: from } : file),
      }));
      setActionError(err instanceof Error ? err.message : `Could not rename ${from}.`);
    } finally {
      setFileBusy(false);
    }
  };

  const deleteFile = async (name: string) => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeletingTarget(name);
    setActionError(null);
    const beforeFiles = files;
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const optimisticFiles = files.filter((file) => file.name !== name);
      setFiles(optimisticFiles);
      updateProjectCache((current) => ({
        ...current,
        files: current.files.filter((file) => file.name !== name),
      }));
      await deleteLabFile(token, project.id, name);
      const idx = tabs.indexOf(name);
      const nextTabs = tabs.filter((t) => t !== name);
      setTabs(nextTabs);
      if (active === name) setActive(nextTabs[Math.max(0, idx - 1)] ?? null);
      setToast(`Deleted ${name} from the project`);
    } catch (err) {
      setFiles(beforeFiles);
      updateProjectCache((current) => ({
        ...current,
        files: beforeFiles.map((before) => ({ name: before.name, content: before.saved, locked: before.locked })),
      }));
      setActionError(err instanceof Error ? err.message : `Could not delete ${name}.`);
    } finally {
      setDeletingTarget((current) => (current === name ? null : current));
      deletingRef.current = false;
    }
  };

  const handleBack = () => {
    if (dirtyCount > 0 && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    onBack();
  };

  // -------- Explorer tree --------
  // The tree is built from the files themselves, so every folder in it holds
  // at least one real file.
  const tree = useMemo(() => buildTree(files), [files]);
  const rootFolders = useMemo(
    () => [...tree.values()].filter((node) => !node.path.includes('/')),
    [tree],
  );
  const rootFiles = useMemo(() => files.filter((file) => !file.name.includes('/')), [files]);

  // Writes to the project store take a moment, so they get the stock loader
  // over the whole editor rather than a quiet button state.
  const writeBusy = creating || fileBusy || importBusy;
  const writeLabel = creating
    ? 'Creating your file…'
    : fileBusy
      ? 'Renaming your file…'
      : 'Importing your files…';
  const writeSub = creating
    ? 'Adding the file to your project.'
    : fileBusy
      ? 'Updating the name in the project store.'
      : 'Copying the folder into your project.';

  const toggleFolder = (path: string, open: boolean) => {
    setExpandedFolders((previous) => {
      const next = new Set(previous);
      if (open) next.add(path);
      else next.delete(path);
      return next;
    });
  };

  const renderFile = (file: EditorFile): ReactNode => {
    if (renaming?.from === file.name) {
      return (
        <li key={file.name}>
          <form
            className="lab-new-file"
            onSubmit={(e) => {
              e.preventDefault();
              void commitRename();
            }}
          >
            <input
              className="lab-new-file-input"
              aria-label={`Rename ${file.name}`}
              autoFocus
              value={renaming.value}
              maxLength={53}
              disabled={fileBusy}
              onChange={(e) => setRenaming({ from: file.name, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setRenaming(null);
              }}
            />
            <p className="lab-new-file-hint">Enter to rename · Esc to cancel</p>
          </form>
        </li>
      );
    }
    return (
      <li key={file.name} className="lab-file-row">
        <button
          type="button"
          className={`lab-file-item ${file.name === active ? 'is-active' : ''}`}
          onClick={() => openFile(file.name)}
        >
          {file.locked ? <Lock size={13} aria-hidden="true" /> : <FileCode size={13} aria-hidden="true" />}
          <span className="lab-file-name">{basename(file.name)}</span>
          {file.locked && <span className="lab-file-badge">read-only</span>}
          {isDirty(file) && <span className="lab-dirty-dot" aria-label="unsaved changes" />}
        </button>
        {!file.locked && (
          <span className="lab-file-actions lab-desktop-only">
            <button
              type="button"
              className="lab-icon-button"
              aria-label={`Rename ${file.name}`}
              title="Rename"
              onClick={() => startRename(file.name)}
            >
              <Pencil size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="lab-icon-button lab-icon-button-danger"
              aria-label={`Delete ${file.name}`}
              title="Delete"
              onClick={() => { void deleteFile(file.name); }}
            >
              {deletingTarget === file.name
                ? <LoaderInline size={13} tone="inherit" />
                : <Trash2 size={13} aria-hidden="true" />}
            </button>
          </span>
        )}
      </li>
    );
  };

  const renderFolder = (path: string): ReactNode => {
    const node = tree.get(path);
    if (!node) return null;
    const open = expandedFolders.has(path);
    const locked = isCorePath(path);
    return (
      <Collapsible.Root key={path} asChild open={open} onOpenChange={(next) => toggleFolder(path, next)}>
        <li className="lab-folder-group">
          <div className="lab-folder-row">
            <Collapsible.Trigger asChild>
              <button
                type="button"
                className="lab-folder-toggle"
                aria-label={`${open ? 'Collapse' : 'Expand'} folder ${path}`}
              >
                <ChevronRight className={open ? 'is-expanded' : ''} size={13} aria-hidden="true" />
              </button>
            </Collapsible.Trigger>
            <Folder size={13} aria-hidden="true" className="lab-folder-icon" />
            <span className="lab-folder-name">{basename(path)}</span>
            {locked && <span className="lab-file-badge">read-only</span>}
            {/* The workspace root holds every file the student wrote, so it is
                not something they can throw away. */}
            {!locked && path !== WORKSPACE_FOLDER && (
              <button
                type="button"
                className="lab-icon-button lab-icon-button-danger"
                aria-label={`Delete folder ${path} and its contents`}
                title="Delete folder and contents"
                onClick={() => { void deleteFolder(path); }}
              >
                {deletingTarget === path
                  ? <LoaderInline size={12} tone="inherit" />
                  : <Trash2 size={12} aria-hidden="true" />}
              </button>
            )}
          </div>
          <Collapsible.Content asChild>
            <ul className="lab-folder-children">
              {node.children.map(renderFolder)}
              {node.files.map(renderFile)}
            </ul>
          </Collapsible.Content>
        </li>
      </Collapsible.Root>
    );
  };

  const bodyStyle = { '--sidebar-width': `${sidebarWidth}px` } as CSSProperties;

  return (
    <div className="lab-editor">
      <header className="lab-editor-bar">
        <Button variant="ghost" size="sm" className="lab-editor-back" onClick={handleBack}>
          <ArrowLeft size={14} aria-hidden="true" /> Projects
        </Button>
        <div className="lab-editor-title">
          <span className="lab-editor-workspace">{workspaceName}</span>
          <h1 className="lab-editor-project">{project.name}</h1>
        </div>
        <div className="lab-editor-actions">
          <span
            className={`lab-editor-status lab-desktop-only ${dirtyCount > 0 ? 'is-dirty' : ''} ${savingFile || deletingTarget ? 'is-busy' : ''}`}
            aria-live="polite"
          >
            {savingFile ? (
              <>
                <LoaderInline size={14} />
                Saving…
              </>
            ) : deletingTarget ? (
              <>
                <LoaderInline size={14} />
                Deleting…
              </>
            ) : dirtyCount > 0 ? (
              `${dirtyCount} unsaved ${dirtyCount === 1 ? 'change' : 'changes'}`
            ) : (
              'All changes saved'
            )}
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="lab-editor-btn lab-desktop-only"
            disabled={!activeFile || !isDirty(activeFile)}
            onClick={() => active && void saveFile(active)}
            title="Save (Ctrl+S)"
          >
            {savingFile ? (
              <>
                <LoaderInline tone="inherit" />
                Saving…
              </>
            ) : (
              <>
                <Save size={14} aria-hidden="true" /> Save
              </>
            )}
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="lab-editor-btn lab-desktop-only"
            disabled={!activeFile || loading}
            onClick={runActive}
            title="Run the open file (Ctrl+Enter)"
          >
            <Play size={12} aria-hidden="true" /> Run
          </Button>
        </div>
      </header>

      {error && <p className="lab-status is-error lab-editor-error">{error}</p>}

      <p className="lab-mobile-note">
        Editing and running are desktop-only. On a phone, review the project files here.
      </p>

      <div className="lab-ide" style={bodyStyle}>
        <div className="lab-ide-body">
          <aside className="lab-explorer" aria-label="Project files">
            <div className="lab-explorer-header">
              <div className="lab-explorer-heading">
                <p className="lab-explorer-title">Explorer</p>
                <span className="lab-explorer-count">{files.length} files · {tree.size} folders</span>
              </div>
              <div className="lab-explorer-tools lab-desktop-only">
                <button
                  type="button"
                  className="lab-icon-button"
                  aria-label="Import a folder from this computer"
                  title="Import folder"
                  disabled={readingFolder}
                  onClick={() => { void handleImport(); }}
                >
                  {readingFolder
                    ? <LoaderInline size={14} tone="inherit" />
                    : <FolderInput size={14} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  className="lab-icon-button"
                  aria-label="New file"
                  aria-expanded={newFileOpen}
                  title="New file"
                  onClick={() => setNewFileOpen((open) => !open)}
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
              </div>
            </div>

            {newFileOpen && (
              <form className="lab-new-file lab-desktop-only" onSubmit={(event) => void handleCreate(event)}>
                <input
                  ref={newFileInputRef}
                  className="lab-new-file-input"
                  aria-label="File path"
                  placeholder="helpers/signals.py"
                  value={newName}
                  maxLength={108}
                  disabled={creating}
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') closeNewFile();
                  }}
                />
                <p className="lab-new-file-hint">Goes into {WORKSPACE_FOLDER}/ · Enter to create · Esc to cancel</p>
              </form>
            )}

            <ul className="lab-folder-tree">
              {rootFolders.map((node) => renderFolder(node.path))}
            </ul>

            {rootFiles.length > 0 && (
              <ul className="lab-file-tree">
                <li className="lab-explorer-section-label">Project root</li>
                {rootFiles.map(renderFile)}
              </ul>
            )}
          </aside>

          <div
            className="lab-ide-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize file explorer"
            aria-valuemin={SIDEBAR_MIN}
            aria-valuemax={SIDEBAR_MAX}
            aria-valuenow={sidebarWidth}
            tabIndex={0}
            onPointerDown={startResize}
            onKeyDown={handleResizeKey}
          />

          <section className="lab-ide-main">
            <div className="lab-tabs" role="tablist">
              {tabs.map((name) => {
                const file = files.find((f) => f.name === name);
                return (
                  <div key={name} className={`lab-tab ${name === active ? 'is-active' : ''}`}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={name === active}
                      className="lab-tab-label"
                      onClick={() => setActive(name)}
                    >
                      {file?.locked && <Lock size={11} aria-hidden="true" />}
                      {basename(name)}
                      {file && isDirty(file) && <span className="lab-dirty-dot" aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      className="lab-tab-close"
                      aria-label={`Close ${name}`}
                      onClick={() => closeTab(name)}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="lab-editor-surface">
              {loading && (
                <div className="lab-editor-placeholder lab-editor-loading">
                  <LoaderScreen
                    label="Loading files…"
                    sub="Reading the project files from the account store."
                  />
                </div>
              )}
              {!loading && !activeFile && (
                <p className="lab-editor-placeholder">Open a file from the explorer to start editing.</p>
              )}
              {!loading && activeFile && (
                <Editor
                  height="100%"
                  path={activeFile.name}
                  language="python"
                  value={activeFile.draft}
                  theme={editorTheme === 'vs-dark' ? 'sltp-dark' : 'sltp-light'}
                  onMount={handleMount}
                  loading={
                    <div className="lab-editor-monaco-loading">
                      <LoaderScreen
                        label="Starting the editor…"
                        sub="Warming up the code editor."
                        compact
                      />
                    </div>
                  }
                  options={{
                    readOnly: activeFile.locked,
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
                    fontLigatures: true,
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    padding: { top: 10 },
                    tabSize: 4,
                    renderLineHighlight: 'line',
                    automaticLayout: true,
                  }}
                />
              )}
            </div>

            {terminalOpen && (
              <TerminalPanel lines={output} onClear={clearOutput} onClose={closeTerminal} />
            )}
          </section>
        </div>

        <footer className="lab-statusbar">
          <div className="lab-statusbar-group">
            <span className={`lab-statusbar-item is-${pyright}`}>{PYRIGHT_LABEL[pyright]}</span>
            <button
              type="button"
              className={`lab-statusbar-item lab-statusbar-button ${markerCounts.errors > 0 ? 'has-errors' : ''}`}
              onClick={jumpToNextError}
              title="Jump to the next error in this file"
            >
              {markerCounts.errors} error{markerCounts.errors === 1 ? '' : 's'} · {markerCounts.warnings} warning{markerCounts.warnings === 1 ? '' : 's'}
            </button>
          </div>
          <div className="lab-statusbar-group">
            <button
              type="button"
              className="lab-statusbar-item lab-statusbar-button"
              onClick={() => setTerminalOpen((open) => !open)}
            >
              <TerminalIcon size={11} aria-hidden="true" /> {terminalOpen ? 'Hide terminal' : 'Show terminal'}
            </button>
            <CursorStatus listenerRef={cursorListenerRef} />
            <span className="lab-statusbar-item">Python</span>
          </div>
        </footer>
      </div>

      {pendingImport && (
        <ImportFolderDialog
          map={pendingImport}
          busy={importBusy}
          error={importError}
          onConfirm={() => { void confirmImport(); }}
          onCancel={() => { setPendingImport(null); setImportError(null); }}
        />
      )}

      {toast && <SuccessToast message={toast} onClose={dismissToast} />}

      {writeBusy && (
        <LoaderOverlay label={writeLabel} sub={writeSub} />
      )}
    </div>
  );
}

interface CursorStatusProps {
  listenerRef: RefObject<((position: { line: number; column: number }) => void) | null>;
}

// The cursor position shown in the status bar. It owns its state, so a cursor move re-renders
// only this line rather than the whole editor page.
function CursorStatus({ listenerRef }: CursorStatusProps) {
  const [cursor, setCursor] = useState({ line: 1, column: 1 });

  useEffect(() => {
    listenerRef.current = setCursor;
    return () => {
      listenerRef.current = null;
    };
  }, [listenerRef]);

  return <span className="lab-statusbar-item">Ln {cursor.line}, Col {cursor.column}</span>;
}

interface TerminalPanelProps {
  lines: OutputLine[];
  onClear: () => void;
  onClose: () => void;
}

// Output of the run: the command, its output and the exit line.
// Memoized, so typing in the editor does not re-render a long output log.
const TerminalPanel = memo(TerminalPanelView);

function TerminalPanelView({ lines, onClear, onClose }: TerminalPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <section className="lab-terminal" aria-label="Terminal">
      <header className="lab-terminal-bar">
        <span className="lab-terminal-tab">
          <TerminalIcon size={12} aria-hidden="true" /> Terminal
        </span>
        <span className="lab-terminal-status">{RUN_LABEL}</span>
        <span className="lab-terminal-spacer" />
        <button type="button" className="lab-terminal-text-button" onClick={onClear}>Clear</button>
        <button type="button" className="lab-icon-button" aria-label="Close terminal" title="Close" onClick={onClose}>
          <X size={13} aria-hidden="true" />
        </button>
      </header>
      <div className="lab-terminal-body" ref={bodyRef} role="log" aria-live="polite">
        {lines.length === 0 ? (
          <p className="lab-terminal-empty">
            Press Run (or Ctrl+Enter) to run the open file. It runs on the server, and the
            output appears here.
          </p>
        ) : (
          lines.map((line) => (
            <div key={line.id} className={`lab-terminal-line is-${line.kind}`}>
              {line.text}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
