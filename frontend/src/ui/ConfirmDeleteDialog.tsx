// ConfirmDeleteDialog.tsx — Destructive-action dialog that requires typing CONFIRM.

import { useEffect, useState, type ReactNode } from 'react';
import Button from './Button';
import Input from './Input';
import { LoaderInline } from './Loader';
import './ConfirmDeleteDialog.css';

interface ConfirmDeleteDialogProps {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel = 'Delete permanently',
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps) {
  const [typed, setTyped] = useState('');
  const ready = typed.trim().toUpperCase() === 'CONFIRM' && !busy;

  // Escape closes the dialog, except while the delete is in flight.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel]);

  const submit = () => {
    if (ready) onConfirm();
  };

  return (
    <div className="confirm-delete-overlay" onClick={() => { if (!busy) onCancel(); }}>
      <div
        className="confirm-delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-delete-title" className="confirm-delete-title">{title}</h3>
        <div className="confirm-delete-text">{description}</div>

        <label className="confirm-delete-label" htmlFor="confirm-delete-input">
          Type <span className="confirm-delete-code">CONFIRM</span> to continue
        </label>
        <Input
          id="confirm-delete-input"
          type="text"
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="CONFIRM"
          disabled={busy}
        />

        {error && <p className="confirm-delete-error" role="alert">{error}</p>}

        <div className="confirm-delete-actions">
          <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="md" className="confirm-delete-danger" disabled={!ready} onClick={submit}>
            {busy ? (
              <>
                <LoaderInline tone="inherit" />
                Deleting…
              </>
            ) : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
