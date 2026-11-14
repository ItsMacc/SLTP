// LabEditorPage.tsx — Lab project editor. A dark IDE frame with a file tree, tabs, a Monaco
// editor checked live by Pyright (in a Web Worker), and a terminal.
//
// A project has two packages:
//   core/       the read-only engine (Strategy, PortfolioManager, Order, Trade,
//               StockData and supporting types), mirrored from the repo
//   workspace/  the strategy files the student writes
//
// The tree is built from the files themselves, so a folder is only shown when
// a real file lives in it. Python runs in a browser worker (python.worker.ts),
// with the project's files written to its own in-memory disk before each run.
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
  History,
  Laptop,
  Lock,
  Pencil,
  Play,
  Plus,
  Save,
  Settings2,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import {
  createLabBacktest,
  createLabFile,
  deleteLabFile,
  deleteLabFolder,
  flushLabFilesOnExit,
  getLabProjectFiles,
  importLabFiles,
  renameLabBacktest,
  renameLabFile,
  saveLabFiles,
  type LabBacktestSummary,
  type LabProject,
} from '../lab/store';
import { dropDraft, readProjectDrafts, writeDraft } from '../lab/drafts';
import { writeCachedBacktest } from '../lab/backtestCache';
import { getPythonState, loadPython, runPython, stopRun, subscribePython } from '../lab/pythonRunner';
import LabResultsWindow from '../lab/LabResultsWindow';
import LabBacktestsWindow from '../lab/LabBacktestsWindow';
import LabRunProgress from '../lab/LabRunProgress';
import LabRunSettingsDialog from '../lab/LabRunSettings';
import {
  readLabRunSettings,
  saveLabRunSettings,
  toEngineSettings,
  type LabRunSettings,
} from '../lab/runSettings';
import { isMobileDevice } from '../store/device';
import { isLabBacktestPayload, type LabBacktestPayload } from '../lab/backtestTypes';
import {
  setJediBusy,
  setJediFileOpener,
  setJediProject,
  setJediStatusListener,
  setJediTarget,
  type Monaco,
} from '../lab/jedi';
import { applyLabEditorTheme } from '../lab/editorTheme';
import { pickLocalFolder, type FolderFileMap } from '../lab/fileReader';
import ImportFolderDialog from '../lab/ImportFolderDialog';
import Button from '../ui/Button';
import SuccessToast from '../ui/SuccessToast';
import { LoaderInline, LoaderOverlay, LoaderScreen } from '../ui/Loader';
import { modShortcut } from '../shortcuts';
import './LabEditorPage.css';

const FILE_NAME_RE = /^(?:[A-Za-z0-9_-]{1,50}\/)*[A-Za-z0-9_-]{1,50}\.py$/;
// A class that extends Strategy. A run only opens the backtest window when the
// file being run actually defines one (or still calls Backtester directly).
const STRATEGY_CLASS_RE = /^\s*class\s+[A-Za-z_]\w*\s*\([^)\n]*\bStrategy\b[^)\n]*\)\s*:/m;
const BACKTESTER_RE = /\bBacktester\s*\(/;
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

type AnalysisState = 'starting' | 'active' | 'failed';

/** The Code editor settings saved on the account (Settings → Code editor). */
interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  fontLigatures: boolean;
}

const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  tabSize: 4,
  wordWrap: false,
  minimap: false,
  lineNumbers: true,
  fontLigatures: true,
};

/** Code editor settings saved on this device, when there are any. */
function readEditorSettings(): EditorSettings {
  try {
    const raw = window.localStorage.getItem('sltp.lab.editorSettings');
    if (!raw) return DEFAULT_EDITOR_SETTINGS;
    return { ...DEFAULT_EDITOR_SETTINGS, ...(JSON.parse(raw) as Partial<EditorSettings>) };
  } catch {
    return DEFAULT_EDITOR_SETTINGS;
  }
}

interface LabEditorPageProps {
  project: LabProject;
  workspaceName: string;
  onBack: () => void;
}

function isDirty(file: EditorFile): boolean {
  return !file.locked && file.draft !== file.saved;
}

const ANALYSIS_LABEL: Record<AnalysisState, string> = {
  starting: 'Analysis starting…',
  active: 'Analysis ready',
  failed: 'Analysis unavailable',
};

export default function LabEditorPage({ project, workspaceName, onBack }: LabEditorPageProps) {
  const python = useSyncExternalStore(subscribePython, getPythonState);
  const [running, setRunning] = useState(false);
  const [files, setFiles] = useState<EditorFile[]>([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set<string>(TOP_FOLDERS));
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const projectFilesQuery = useQuery({
    queryKey: ['lab', 'project-files', project.id],
    queryFn: () => getLabProjectFiles(project.id),
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? (projectFilesQuery.error instanceof Error
    ? projectFilesQuery.error.message
    : projectFilesQuery.error ? 'Could not load the workspace files.' : null);
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
  const [closing, setClosing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  // The run window, then the report it hands over to. A saved report keeps
  // its Turso summary so the title can be renamed and the date shown.
  const [run, setRun] = useState<{ startedAt: number; stage: string; error?: string } | null>(null);
  // What the running interpreter is doing right now, and for how long. Shown in
  // the logs pane, so a run that prints nothing for a minute never looks stuck.
  const [runStage, setRunStage] = useState<string | null>(null);
  const [runElapsed, setRunElapsed] = useState(0);
  const [backtest, setBacktest] = useState<{
    payload: LabBacktestPayload;
    fileName: string;
    saved: LabBacktestSummary | null;
    saveError: string | null;
  } | null>(null);
  const [backtestsOpen, setBacktestsOpen] = useState(false);
  // The dates and costs the next run uses. The dialog starts at the engine
  // defaults, so a first run needs no setup.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [runSettings, setRunSettings] = useState<LabRunSettings>(readLabRunSettings);
  const mobileDevice = isMobileDevice();

  // Monaco sizes itself from its container, and in the stacked layout that box
  // is still zero when it mounts. An explicit pixel height from React means it
  // is right the first time, in every window shape.
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const [editorHeight, setEditorHeight] = useState<number | null>(null);
  useEffect(() => {
    const host = editorHostRef.current;
    if (!host) return;
    const measure = () => {
      const height = Math.floor(host.getBoundingClientRect().height);
      if (height > 0) setEditorHeight(height);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    measure();
    return () => observer.disconnect();
  }, []);

  const [analysis, setAnalysis] = useState<AnalysisState>('starting');
  const [analysisReason, setAnalysisReason] = useState<string | null>(null);
  // Until the interpreter answers, the wait is counted out rather than shown
  // as a frozen label.
  const [analysisSeconds, setAnalysisSeconds] = useState(0);
  const [editorTheme, setEditorTheme] = useState<'vs' | 'vs-dark'>(() => {
    const saved = sessionStorage.getItem('st_user_theme')?.toLowerCase();
    const theme = document.documentElement.getAttribute('data-theme')?.toLowerCase() ?? saved;
    return theme === 'dark' ? 'vs-dark' : 'vs';
  });
  const [editorSettings] = useState<EditorSettings>(readEditorSettings);
  const [markerCounts, setMarkerCounts] = useState({ errors: 0, warnings: 0 });
  // The cursor readout lives in its own component, so moving the cursor does not re-render the page.
  const cursorListenerRef = useRef<((position: { line: number; column: number }) => void) | null>(null);

  // Python boots as the project opens, so Run is usually live by the time the
  // reader has looked around the explorer.
  useEffect(() => {
    // A phone never reaches the editor, so it should not pay for a Python boot.
    if (mobileDevice) return;
    loadPython();
  }, [mobileDevice]);

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

  // Opening a workspace should start at the top of the page, not at wherever the list was scrolled.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  const latestFilesRef = useRef(files);
  useEffect(() => {
    latestFilesRef.current = files;
  }, [files]);

  // A draft this browser kept from an earlier visit is newer than the server
  // copy by definition, so it is what opens. Identical drafts are just noise.
  const restoredDraftsRef = useRef(false);
  useEffect(() => {
    const data = projectFilesQuery.data;
    if (!data) return;
    const cached = restoredDraftsRef.current ? new Map<string, string>() : readProjectDrafts(project.id);
    let restored = 0;
    const list: EditorFile[] = data.files.map((file) => {
      const previous = latestFilesRef.current.find((item) => item.name === file.name);
      const cachedDraft = cached.get(file.name);
      const fromCache = cachedDraft !== undefined && cachedDraft !== file.content ? cachedDraft : null;
      if (fromCache !== null) restored += 1;
      return {
        name: file.name,
        locked: file.locked,
        saved: file.content,
        draft: previous?.draft ?? fromCache ?? file.content,
      };
    });
    if (restored > 0) {
      setToast(`Restored ${restored} unsaved ${restored === 1 ? 'file' : 'files'} from this browser.`);
      restoredDraftsRef.current = true;
    }
    // Every written file opens as a tab, so the whole workspace is visible at
    // once. The read-only core is there to read, not to edit.
    const editable = list.filter((file) => !file.locked).map((file) => file.name);
    const first = editable[0] ?? list[0]?.name ?? null;
    setFiles(list);
    // The two packages start open; deeper folders stay as the user left them.
    setExpandedFolders((previous) => new Set([...previous, ...TOP_FOLDERS]));
    setTabs((previous) => {
      if (previous.length) return previous.filter((name) => list.some((file) => file.name === name));
      return editable.length ? editable : first ? [first] : [];
    });
    setActive((previous) => previous && list.some((file) => file.name === previous) ? previous : first);
  // Keep unsaved drafts local; reconcile only when the cache snapshot changes.
  }, [projectFilesQuery.data, project.id]);

  // Insurance for typing: every dirty buffer lands in localStorage on a short
  // debounce, so a crash or a forced quit costs at most those two seconds. The
  // write is local and synchronous, which is the one thing a network save
  // cannot promise on the way out of a page.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const file of latestFilesRef.current) {
        if (file.locked) continue;
        if (isDirty(file)) writeDraft(project.id, file.name, file.draft);
        else dropDraft(project.id, file.name);
      }
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [files, project.id]);

  useEffect(() => {
    if (newFileOpen) newFileInputRef.current?.focus();
  }, [newFileOpen]);

  const loading = projectFilesQuery.isPending && files.length === 0;
  const dirtyCount = files.filter(isDirty).length;
  const activeFile = files.find((f) => f.name === active) ?? null;
  const runnerLabel = python.status === 'ready'
    ? [
        python.version ? `Python ${python.version}` : 'Python',
        python.engine
          ? python.market === false
            ? 'sltp ready · market unavailable'
            : 'sltp ready'
          : 'sltp unavailable',
      ].join(' · ')
    : python.status === 'loading'
      ? (python.detail ?? 'Starting Python…')
      : python.status === 'error'
        ? 'Python could not start'
        : 'Python is not running';

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

  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const flushAgainRef = useRef(false);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);

  /**
   * Write every dirty file in one request. Saves are coalesced, not queued: a
   * call while one is running marks the batch dirty again instead of opening a
   * second request, and a call with nothing changed never reaches the network.
   * A hammered Cmd+S therefore costs at most one request, and usually none.
   */
  const flush = async (): Promise<boolean> => {
    if (inFlightRef.current) {
      flushAgainRef.current = true;
      return inFlightRef.current;
    }
    const dirty = latestFilesRef.current.filter(isDirty);
    if (dirty.length === 0) return true;
    const batch = dirty.map((file) => ({ path: file.name, content: file.draft }));
    setActionError(null);
    setSavingFile(dirty.length === 1 ? dirty[0].name : null);
    const run = (async () => {
      try {
        await saveLabFiles(project.id, batch);
        const written = new Map(batch.map((file) => [file.path, file.content]));
        for (const file of batch) dropDraft(project.id, file.path);
        setFiles((previous) =>
          previous.map((current) =>
            written.has(current.name)
              ? { ...current, saved: written.get(current.name) as string }
              : current,
          ),
        );
        updateProjectCache((current) => ({
          ...current,
          files: current.files.map((saved) =>
            written.has(saved.name)
              ? { ...saved, content: written.get(saved.name) as string }
              : saved,
          ),
        }));
        return true;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not save your changes.');
        return false;
      }
    })();
    inFlightRef.current = run;
    const ok = await run;
    inFlightRef.current = null;
    setSavingFile(null);
    if (flushAgainRef.current) {
      flushAgainRef.current = false;
      return flushRef.current();
    }
    return ok;
  };

  // The toolbar names one file, but the write covers every dirty one.
  const saveFile = async () => {
    await flush();
  };

  // -------- Analysis: jedi, inside the Python worker --------

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

  // Points the analyser at the shown model. Jedi reads the buffer itself, so
  // there is no second copy of the document to keep in step.
  const bindActiveModel = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;
    setJediTarget({ monaco, model, path: model.uri.path.replace(/^\//, '') });
    refreshMarkerCounts();
  }, [refreshMarkerCounts]);

  // The interpreter is the analyser, so binding waits for it to be ready, and
  // follows every switch of the shown file.
  useEffect(() => {
    if (python.status === 'ready') bindActiveModel();
  }, [active, python.status, bindActiveModel]);

  // The project's files are what jedi resolves imports against, so every save
  // hands it the new text.
  useEffect(() => {
    const saved: Record<string, string> = {};
    for (const file of files) saved[file.name] = file.saved;
    setJediProject(saved);
  }, [files]);

  // The first answer flips the status bar to ready; a failure carries its
  // reason so the bar can say what happened.
  useEffect(() => {
    setJediStatusListener((status, reason) => {
      setAnalysis(status);
      setAnalysisReason(status === 'failed' ? reason ?? 'no answer from jedi' : null);
    });
    return () => setJediStatusListener(null);
  }, []);

  // The editor's own mount callback does not fire reliably when its box is
  // still being sized by the stacked layout, which left it unthemed at five
  // pixels. Once the editor exists, applying the theme and laying it out costs
  // nothing and works whatever the callback did.
  useEffect(() => {
    const settle = () => {
      const monaco = (window as unknown as { monaco?: Monaco }).monaco;
      if (!monaco) return false;
      applyLabEditorTheme(monaco, editorTheme);
      const editor = monaco.editor.getEditors?.()[0];
      if (!editor) return false;
      const host = editor.getContainerDomNode().parentElement;
      const box = host?.getBoundingClientRect();
      if (box && box.width > 2 && box.height > 2) {
        editor.layout({ width: Math.floor(box.width), height: Math.floor(box.height) });
      }
      return true;
    };
    settle();
    const timer = window.setInterval(() => {
      if (settle()) window.clearInterval(timer);
    }, 250);
    const giveUp = window.setTimeout(() => window.clearInterval(timer), 8000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(giveUp);
    };
  }, [editorTheme, active]);

  // A definition that lives in another project file opens that file and lands
  // the cursor on the line, which is the half of go-to-definition that cannot
  // happen inside a single editor.
  const pendingCursorRef = useRef<{ path: string; line: number; column: number } | null>(null);
  useEffect(() => {
    setJediFileOpener((path, line, column) => {
      pendingCursorRef.current = { path, line, column };
      setActive(path);
    });
    return () => setJediFileOpener(null);
  }, []);

  useEffect(() => {
    const pending = pendingCursorRef.current;
    if (!pending || pending.path !== active) return;
    pendingCursorRef.current = null;
    const timer = window.setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const position = { lineNumber: pending.line, column: pending.column };
      editor.setPosition(position);
      editor.revealPositionInCenter(position);
      editor.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (analysis !== 'starting') return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setAnalysisSeconds(Math.round((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [analysis]);

  // The editor is created with theme="sltp-dark", so that theme has to exist
  // before it mounts. Registering it in onMount is too late: the editor throws
  // on the unknown theme and never calls back, which left it at five pixels
  // with Monaco's default colours and no layout at all.
  const handleBeforeMount = (monacoInstance: Parameters<OnMount>[1]) => {
    applyLabEditorTheme(monacoInstance as Monaco, editorTheme);
  };

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
    // Monaco measures its container once. In the stacked layout the container
    // is still being sized by flex at that moment, so it laid itself out at
    // zero and stayed a sliver — invisible code in a narrow window. Watching
    // the box covers that, a window resize and the terminal opening.
    const host = editor.getContainerDomNode().parentElement ?? editor.getContainerDomNode();
    let pending = 0;
    const relayout = () => {
      // Explicit numbers: left to measure for itself, Monaco kept the zero it
      // found while flex was still settling.
      const box = host.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) return;
      editor.layout({ width: Math.floor(box.width), height: Math.floor(box.height) });
    };
    const observer = new ResizeObserver(() => {
      if (pending) return;
      pending = window.requestAnimationFrame(() => {
        pending = 0;
        relayout();
      });
    });
    observer.observe(host);
    window.requestAnimationFrame(relayout);

    editor.onDidDispose(() => {
      markerSub.dispose();
      observer.disconnect();
      if (pending) window.cancelAnimationFrame(pending);
      setJediTarget(null);
    });

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
  // Python runs in the page's own worker (lab/python.worker.ts), so a run
  // costs no request and works offline once the interpreter has loaded. The
  // open file's draft is what runs, unsaved edits included.

  const appendLine = (kind: OutputLine['kind'], text: string) => {
    lineIdRef.current += 1;
    const id = lineIdRef.current;
    setOutput((prev) => [...prev.slice(-1999), { id, kind, text }]);
  };

  const runActive = async () => {
    if (!activeFile || running) return;
    setTerminalOpen(true);
    // Cancelling a run leaves the interpreter torn down on purpose, so the
    // first click after a cancel starts it again instead of doing nothing.
    if (getPythonState().status === 'idle') {
      loadPython();
      appendLine('info', 'Python is starting. Run again when it is ready.');
      return;
    }
    if (getPythonState().status !== 'ready') {
      appendLine('info', 'Python is still starting. Run turns on when it is ready.');
      return;
    }
    if (!getPythonState().engine) {
      appendLine('info', 'The trading engine is still installing. Run turns on when it is ready.');
      return;
    }

    setRunning(true);
    // Completions would queue in front of the run and delay its first byte.
    setJediBusy(true);
    setOutput([]);
    setRunStage('Waiting for Python…');
    setRunElapsed(0);
    const startedAt = Date.now();
    // A plain script (print(10), a helper import) is still a useful run, but it
    // is not a backtest: no progress window, no report, just LOGS.
    const showsBacktest = !activeFile.locked
      && (STRATEGY_CLASS_RE.test(activeFile.draft) || BACKTESTER_RE.test(activeFile.draft));
    setRun(showsBacktest ? { startedAt, stage: 'Preparing the workspace…' } : null);
    appendLine('command', `$ run ${activeFile.name}`);
    try {
    const result = await runPython(
      activeFile.name,
      activeFile.draft,
      // Every file's draft goes in, so a helper edited but not saved is still
      // what the entry file imports.
      files.map((file) => ({ name: file.name, content: file.draft })),
      {
        onProgress: (text) => {
          setRunStage(text);
          if (showsBacktest) setRun((current) => (current ? { ...current, stage: text } : current));
        },
        // Chunks arrive on line boundaries with their newline still attached.
        onOutput: (text) => appendLine('stdout', text.replace(/\n$/, '')),
        onOutputError: (text) => appendLine('stderr', text.replace(/\n$/, '')),
      },
      toEngineSettings(runSettings),
    );

    if (result.ok) {
      appendLine('info', `Finished in ${Math.max(1, Math.round(result.durationMs))} ms`);
      if (isLabBacktestPayload(result.result)) {
        const payload: LabBacktestPayload = {
          ...result.result,
          logs: result.logs ?? [],
          file_name: activeFile.name,
        };
          if (showsBacktest) {
            setRun((current) => (current ? { ...current, stage: 'Saving the backtest…' } : current));
          }
        let saved: LabBacktestSummary | null = null;
        let saveError: string | null = null;
        try {
          saved = await createLabBacktest(project.id, payload);
          // Keep the report on this machine too, so history opens without a
          // round trip and the result survives an offline visit.
          void writeCachedBacktest({ ...saved, payload });
        } catch (err) {
          saveError = err instanceof Error ? err.message : 'Could not save the backtest.';
        }
        setRun(null);
        setBacktest({ payload, fileName: activeFile.name, saved, saveError });
      } else {
        if (result.notice) appendLine('info', result.notice);
        setRun(null);
      }
    } else {
      appendLine('stderr', result.error ?? 'The run failed.');
      if (showsBacktest) {
        setRun((current) =>
          current
            ? { ...current, error: result.error ?? 'The strategy stopped before a result was produced.' }
            : current,
        );
      }
    }
    } finally {
      // The spinner must not outlive the run, whatever went wrong.
      setRunning(false);
      setRunStage(null);
      setJediBusy(false);
    }
  };

  // Ticks once a second while a run is in flight, for the elapsed marker in the
  // logs pane. Nothing here touches Python.
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = window.setInterval(() => setRunElapsed(Date.now() - started), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  // The shortcut handler reads the latest closure through this ref.
  useEffect(() => {
    saveActiveRef.current = () => {
      void flushRef.current();
    };
    runActiveRef.current = () => {
      void runActive();
    };
  });

  // Deliberately generous: a flush is free when nothing changed, and the
  // moments that matter are the ones a browser does not warn about.
  useEffect(() => {
    flushRef.current = flush;
  });

  useEffect(() => {
    const flushDirty = () => {
      if (latestFilesRef.current.some(isDirty)) void flushRef.current();
    };
    const checkpoint = window.setInterval(flushDirty, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushDirty();
    };
    // Leaving the page cannot be awaited, so the write goes out keepalive and
    // the local draft covers it if the browser drops it anyway.
    const onPageHide = () => {
      const dirty = latestFilesRef.current.filter(isDirty);
      if (!dirty.length) return;
      void flushLabFilesOnExit(
        project.id,
        dirty.map((file) => ({ path: file.name, content: file.draft })),
      );
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearInterval(checkpoint);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      onPageHide();
    };
  }, [project.id]);

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
      await deleteLabFolder(project.id, name);
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
      const file = await createLabFile(project.id, name);
      setFiles((previous) => previous.map((item) => item.name === name ? { ...item, name: file.name } : item));
      updateProjectCache((current) => ({
        ...current,
        files: current.files.some((item) => item.name === name)
          ? current.files.map((item) => item.name === name ? file : item)
          : [...current.files, file],
      }));
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
      const entries = Object.entries(pendingImport.files).map(([path, content]) => ({ path, content }));
      const result = await importLabFiles(project.id, entries, pendingImport.folders);
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
      setFiles((prev) => prev.map((file) => file.name === from ? { ...file, name: to } : file));
      setTabs((prev) => prev.map((tab) => tab === from ? to : tab));
      setActive((current) => current === from ? to : current);
      updateProjectCache((current) => ({
        ...current,
        files: current.files.map((file) => file.name === from ? { ...file, name: to } : file),
      }));
      const result = await renameLabFile(project.id, from, to);
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
      const optimisticFiles = files.filter((file) => file.name !== name);
      setFiles(optimisticFiles);
      updateProjectCache((current) => ({
        ...current,
        files: current.files.filter((file) => file.name !== name),
      }));
      await deleteLabFile(project.id, name);
      const idx = tabs.indexOf(name);
      const nextTabs = tabs.filter((t) => t !== name);
      setTabs(nextTabs);
      if (active === name) setActive(nextTabs[Math.max(0, idx - 1)] ?? null);
      setToast(`Deleted ${name} from the workspace`);
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

  // Closing the project writes every dirty file before leaving. If a write
  // fails the page stays put with the error, so no work disappears quietly.
  const handleCloseProject = async () => {
    if (closing) return;
    setActionError(null);
    if (!latestFilesRef.current.some(isDirty)) {
      onBack();
      return;
    }
    setClosing(true);
    try {
      // The same single batch the autosave uses, awaited, so the page only
      // leaves once the write is confirmed. A failure keeps the project open
      // with the error visible instead of dropping work on the way out.
      if (await flush()) onBack();
    } finally {
      setClosing(false);
    }
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
    ? 'Adding the file to your workspace.'
    : fileBusy
      ? 'Updating the name in the workspace store.'
      : 'Copying the folder into your workspace.';

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
            <Button
              variant="ghost"
              size="icon"
              className="lab-icon-button"
              aria-label={`Rename ${file.name}`}
              title="Rename"
              onClick={() => startRename(file.name)}
            >
              <Pencil size={13} aria-hidden="true" />
            </Button>
            <Button
              variant="danger"
              size="icon"
              className="lab-icon-button lab-icon-button-danger"
              aria-label={`Delete ${file.name}`}
              title="Delete"
              onClick={() => { void deleteFile(file.name); }}
            >
              {deletingTarget === file.name
                ? <LoaderInline size={13} tone="inherit" />
                : <Trash2 size={13} aria-hidden="true" />}
            </Button>
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
              <Button
                variant="danger"
                size="icon"
                className="lab-icon-button lab-icon-button-danger"
                aria-label={`Delete folder ${path} and its contents`}
                title="Delete folder and contents"
                onClick={() => { void deleteFolder(path); }}
              >
                {deletingTarget === path
                  ? <LoaderInline size={12} tone="inherit" />
                  : <Trash2 size={12} aria-hidden="true" />}
              </Button>
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
    <div className={`lab-editor ${mobileDevice ? 'is-mobile-device' : ''}`}>
      {error && <p className="lab-status is-error lab-editor-error">{error}</p>}

      <div className="lab-mobile-gate">
        <section className="lab-mobile-card" aria-labelledby="lab-mobile-title">
          <span className="lab-mobile-eyebrow">
            <Laptop size={14} aria-hidden="true" /> Desktop only
          </span>
          <p className="lab-mobile-workspace">{workspaceName}</p>
          <h1 className="lab-mobile-title" id="lab-mobile-title">
            Running backtests on mobile isn’t supported yet.
          </h1>
          <p className="lab-mobile-copy">
            Feel free to check out the results from your previous runs. Open this workspace on a
            computer to edit the code and start a new backtest.
          </p>
          <div className="lab-mobile-actions">
            <Button variant="primary" size="md" onClick={() => setBacktestsOpen(true)}>
              <History size={16} aria-hidden="true" /> View backtest results
            </Button>
            <Button variant="ghost" size="md" onClick={onBack}>
              <ArrowLeft size={15} aria-hidden="true" /> Back to workspaces
            </Button>
          </div>
        </section>
      </div>

      {!mobileDevice && (
      <div className="lab-ide" style={bodyStyle}>
        <div className="lab-ide-body">
          <aside className="lab-explorer" aria-label="Workspace files">
            <div className="lab-explorer-header">
              <div className="lab-explorer-heading">
                <p className="lab-explorer-title">Explorer</p>
                <span className="lab-explorer-count">
                  {files.length} {files.length === 1 ? 'file' : 'files'} · {tree.size}{' '}
                  {tree.size === 1 ? 'folder' : 'folders'}
                </span>
              </div>
              <div className="lab-explorer-tools lab-desktop-only">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lab-icon-button"
                  aria-label="Import a folder from this computer"
                  title="Import folder"
                  disabled={readingFolder}
                  onClick={() => { void handleImport(); }}
                >
                  {readingFolder
                    ? <LoaderInline size={14} tone="inherit" />
                    : <FolderInput size={14} aria-hidden="true" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lab-icon-button"
                  aria-label="New file"
                  aria-expanded={newFileOpen}
                  title="New file"
                  onClick={() => setNewFileOpen((open) => !open)}
                >
                  <Plus size={15} aria-hidden="true" />
                </Button>
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
                <li className="lab-explorer-section-label">Workspace root</li>
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
            <div className="lab-tabs">
              <div className="lab-tabs-strip" role="tablist" aria-label="Open files">
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

              <div className="lab-tab-actions">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lab-tab-action"
                  aria-label="Save the open file"
                  title={`Save (${modShortcut('S')})`}
                  disabled={!activeFile || !isDirty(activeFile)}
                  onClick={() => void saveFile()}
                >
                  {savingFile ? <LoaderInline size={14} tone="inherit" /> : <Save size={14} aria-hidden="true" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lab-tab-action"
                  aria-label="Backtest settings"
                  title="Backtest settings: dates and trading costs"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings2 size={15} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lab-tab-action is-run"
                  aria-label="Run the open strategy"
                  title={
                    python.status === 'ready' && python.engine
                      ? `Run the strategy (${modShortcut('Enter')})`
                      : 'Run turns on when Python and sltp finish loading'
                  }
                  disabled={
                    !activeFile
                    || loading
                    || running
                    || (python.status !== 'ready' && python.status !== 'idle')
                    || (python.status === 'ready' && python.engine !== true)
                  }
                  onClick={() => { void runActive(); }}
                >
                  {running ? <LoaderInline size={14} tone="inherit" /> : <Play size={14} aria-hidden="true" />}
                </Button>
                {running && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lab-tab-action is-stop"
                    aria-label="Stop the run"
                    title="Stop and restart Python"
                    onClick={() => {
                      stopRun();
                      setRun(null);
                    }}
                  >
                    <Square size={12} aria-hidden="true" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="lab-tab-action"
                  aria-label="Open saved backtests"
                  title="Backtest results"
                  onClick={() => setBacktestsOpen(true)}
                >
                  <History size={15} aria-hidden="true" />
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="lab-close-project"
                  onClick={() => void handleCloseProject()}
                  disabled={closing}
                  title={
                    dirtyCount > 0
                      ? `Save ${dirtyCount} unsaved ${dirtyCount === 1 ? 'change' : 'changes'} and close`
                      : 'Close the project and return to workspaces'
                  }
                >
                  {closing ? (
                    <>
                      <LoaderInline size={13} tone="inherit" /> Saving…
                    </>
                  ) : (
                    'Close project'
                  )}
                </Button>
              </div>
            </div>

            <div className="lab-editor-surface">
              {loading && (
                <div className="lab-editor-placeholder lab-editor-loading">
                  <LoaderScreen
                    label="Loading files…"
                    sub="Reading the workspace files from the account store."
                  />
                </div>
              )}
              {!loading && !activeFile && (
                <p className="lab-editor-placeholder">Open a file from the explorer to start editing.</p>
              )}
              {!loading && activeFile && (
                <div className="lab-editor-fill" ref={editorHostRef}>
                <Editor
                  height={editorHeight ?? '100%'}
                  path={activeFile.name}
                  language="python"
                  value={activeFile.draft}
                  onChange={(value) => {
                    const next = value ?? '';
                    setFiles((prev) => prev.map((f) => (f.name === activeFile.name ? { ...f, draft: next } : f)));
                  }}
                  theme={editorTheme === 'vs-dark' ? 'sltp-dark' : 'sltp-light'}
                  beforeMount={handleBeforeMount}
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
                    // The VSCode feel: completions open as you type, after a
                    // dot or quote, and while a call's arguments are typed.
                    quickSuggestions: { other: 'on', comments: 'off', strings: 'on' },
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnEnter: 'on',
                    tabCompletion: 'on',
                    parameterHints: { enabled: true },
                    snippetSuggestions: 'inline',
                    wordBasedSuggestions: 'currentDocument',
                    suggest: {
                      showStatusBar: true,
                      preview: true,
                      snippetsPreventQuickSuggestions: false,
                    },
                    minimap: { enabled: editorSettings.minimap },
                    fontSize: editorSettings.fontSize,
                    fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
                    fontLigatures: editorSettings.fontLigatures,
                    lineNumbers: editorSettings.lineNumbers ? 'on' : 'off',
                    wordWrap: editorSettings.wordWrap ? 'on' : 'off',
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    padding: { top: 10 },
                    tabSize: editorSettings.tabSize,
                    renderLineHighlight: 'line',
                    automaticLayout: true,
                  }}
                />
                </div>
              )}
            </div>

            {terminalOpen && (
              <TerminalPanel
                lines={output}
                status={runnerLabel}
                runnerTitle={python.warning ?? undefined}
                running={running}
                stage={runStage}
                elapsedMs={runElapsed}
                onClear={clearOutput}
                onClose={closeTerminal}
              />
            )}
          </section>
        </div>

        <footer className="lab-statusbar">
          <div className="lab-statusbar-group">
            <span
              className={`lab-statusbar-item is-${analysis}`}
              title={analysis === 'failed' && analysisReason ? analysisReason : undefined}
            >
              {analysis === 'starting'
                ? python.status === 'ready'
                  ? `Analysis starting… ${analysisSeconds}s`
                  : 'Python starting…'
                : ANALYSIS_LABEL[analysis]}
              {analysis === 'failed' && analysisReason ? ` · ${analysisReason.slice(0, 90)}` : ''}
            </span>
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
              <TerminalIcon size={11} aria-hidden="true" /> {terminalOpen ? 'Hide logs' : 'Show logs'}
            </button>
            <CursorStatus listenerRef={cursorListenerRef} />
            <span className="lab-statusbar-item">Python</span>
          </div>
        </footer>
      </div>
      )}

      {pendingImport && (
        <ImportFolderDialog
          map={pendingImport}
          busy={importBusy}
          error={importError}
          onConfirm={() => { void confirmImport(); }}
          onCancel={() => { setPendingImport(null); setImportError(null); }}
        />
      )}

      {run && (
        <LabRunProgress
          stage={run.stage}
          startedAt={run.startedAt}
          error={run.error}
          onClose={() => setRun(null)}
          onCancel={() => {
            stopRun();
            setRun(null);
          }}
        />
      )}

      {backtestsOpen && (
        <LabBacktestsWindow
          projectId={project.id}
          workspaceName={workspaceName}
          onClose={() => setBacktestsOpen(false)}
        />
      )}

      {backtest && (
        <LabResultsWindow
          result={backtest.payload}
          fileName={backtest.fileName}
          workspaceName={workspaceName}
          backtestName={backtest.saved?.name}
          backtestId={backtest.saved?.id}
          createdAt={backtest.saved?.created_at}
          saveError={backtest.saveError}
          onRename={
            backtest.saved
              ? async (name) => {
                  const updated = await renameLabBacktest(backtest.saved!.id, name);
                  setBacktest((current) =>
                    current && current.saved
                      ? { ...current, saved: { ...current.saved, name: updated.name } }
                      : current,
                  );
                }
              : undefined
          }
          onClose={() => setBacktest(null)}
        />
      )}

      {settingsOpen && (
        <LabRunSettingsDialog
          value={runSettings}
          onApply={(next) => {
            saveLabRunSettings(next);
            setRunSettings(next);
          }}
          onClose={() => setSettingsOpen(false)}
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
  /** The interpreter's state, shown beside the terminal tab. */
  status: string;
  /** The reason the engine is missing, when it is. */
  runnerTitle?: string;
  /** A run is in flight: what it is doing and how long it has been doing it. */
  running: boolean;
  stage: string | null;
  elapsedMs: number;
  onClear: () => void;
  onClose: () => void;
}

/** "0:07", so a long run reads as a clock rather than a number of seconds. */
function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// Output of the run: the command, its output and the exit line.
// Memoized, so typing in the editor does not re-render a long output log.
const TerminalPanel = memo(TerminalPanelView);

function TerminalPanelView({
  lines,
  status,
  runnerTitle,
  running,
  stage,
  elapsedMs,
  onClear,
  onClose,
}: TerminalPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, running, stage]);

  return (
    <section className="lab-terminal" aria-label="Logs">
      <header className="lab-terminal-bar">
        <span className="lab-terminal-tab">
          <TerminalIcon size={12} aria-hidden="true" /> Logs
        </span>
        <span className="lab-terminal-status" title={runnerTitle}>{status}</span>
        <span className="lab-terminal-spacer" />
        <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>
        <Button variant="ghost" size="icon" className="lab-icon-button" aria-label="Close logs" title="Close" onClick={onClose}>
          <X size={13} aria-hidden="true" />
        </Button>
      </header>
      <div className="lab-terminal-body" ref={bodyRef} role="log" aria-live="polite">
        {lines.length === 0 && !running && (
          <p className="lab-terminal-empty">
            Press Run (or {modShortcut('Enter')}) to run your strategy. Anything your code prints
            appears here; the backtest report opens in its own window.
          </p>
        )}
        {lines.map((line) => (
          <div key={line.id} className={`lab-terminal-line is-${line.kind}`}>
            {line.text}
          </div>
        ))}
        {running && (
          <div className="lab-terminal-line is-progress" role="status">
            <span className="lab-terminal-spinner" aria-hidden="true" />
            <span className="lab-terminal-stage">{stage ?? 'Running…'}</span>
            <span className="lab-terminal-elapsed">{formatElapsed(elapsedMs)}</span>
          </div>
        )}
      </div>
    </section>
  );
}
