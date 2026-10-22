// ImportFolderDialog.ts — Confirms an import before it is written to the project.
//
// The browser read a real folder off disk. This dialog shows that folder's
// files one by one, so nothing is imported that the user cannot see, and
// lists what was left out with the reason. Only the files shown here are sent
// to the server.

import { useEffect } from 'react';
import { FileCode, FolderInput, TriangleAlert } from 'lucide-react';
import Button from '../ui/Button';
import type { FolderFileMap } from './fileReader';
import './ImportFolderDialog.css';

interface ImportFolderDialogProps {
  map: FolderFileMap;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ImportFolderDialog({
  map,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: ImportFolderDialogProps) {
  const paths = Object.keys(map.files).sort();
  const skipped = map.skipped;

  // Escape closes the dialog, except while the import is in flight.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel]);

  return (
    <div className="import-folder-overlay" onClick={() => { if (!busy) onCancel(); }}>
      <div
        className="import-folder-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-folder-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="import-folder-head">
          <span className="import-folder-icon" aria-hidden="true">
            <FolderInput size={16} />
          </span>
          <div>
            <h3 id="import-folder-title" className="import-folder-title">Import from {map.root}</h3>
            <p className="import-folder-sub">
              {paths.length === 1 ? '1 file' : `${paths.length} files`} will be copied into
              {' '}<code>workspace/</code>. Files already there with the same name are replaced.
            </p>
          </div>
        </header>

        <div className="import-folder-body">
          <ul className="import-folder-list">
            {paths.map((path) => (
              <li key={path} className="import-folder-item">
                <FileCode size={13} aria-hidden="true" />
                <span className="import-folder-path">{path}</span>
              </li>
            ))}
          </ul>

          {skipped.length > 0 && (
            <div className="import-folder-skipped">
              <p className="import-folder-skipped-title">
                <TriangleAlert size={13} aria-hidden="true" />
                {skipped.length === 1 ? '1 file was left out' : `${skipped.length} files were left out`}
              </p>
              <ul className="import-folder-skipped-list">
                {skipped.map((entry) => (
                  <li key={entry.path} className="import-folder-skipped-item">
                    <span className="import-folder-path">{entry.path}</span>
                    <span className="import-folder-reason">{entry.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {error && <p className="import-folder-error" role="alert">{error}</p>}

        <div className="import-folder-actions">
          <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onConfirm}
            disabled={busy || paths.length === 0}
          >
            {busy ? 'Importing…' : `Import ${paths.length} ${paths.length === 1 ? 'file' : 'files'}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
