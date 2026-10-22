// LabNewProject.tsx — Onboarding for a new Lab project: workspace, name, starting code, review.
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { LabWorkspace } from '../../lib/api';
import { LAB_TEMPLATES, getTemplate, type LabTemplateId } from '../lab/templates';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import './LabNewProject.css';

const NAME_MAX = 60;

export interface NewProjectInput {
  workspaceId: string | null;
  workspaceName: string;
  projectName: string;
  template: LabTemplateId;
}

interface LabNewProjectProps {
  workspaces: LabWorkspace[];
  initialTemplate: LabTemplateId;
  /** Which branch of the workspace step opens first. */
  initialTarget?: 'existing' | 'new';
  onClose: () => void;
  onCreate: (input: NewProjectInput) => Promise<void>;
}

type Step = 'workspace' | 'project' | 'template' | 'review';
const STEPS: { id: Step; label: string }[] = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'project', label: 'Project' },
  { id: 'template', label: 'Starting code' },
  { id: 'review', label: 'Review' },
];

export default function LabNewProject({ workspaces, initialTemplate, initialTarget, onClose, onCreate }: LabNewProjectProps) {
  const [step, setStep] = useState<Step>('workspace');
  // Set once the user picks a branch, so an async workspace list cannot undo their choice.
  const [targetChoice, setTargetChoice] = useState<'existing' | 'new' | null>(null);
  // The workspace the user picked. Null means "the first one", which is what
  // the list shows until a choice is made.
  const [existingChoice, setExistingChoice] = useState<string | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [template, setTemplate] = useState<LabTemplateId>(initialTemplate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes the dialog unless a submit is in flight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  // The workspace list arrives from Turso, so the selection follows it: the
  // chosen workspace when it still exists, otherwise the first one.
  const existingId =
    existingChoice && workspaces.some((w) => w.id === existingChoice)
      ? existingChoice
      : (workspaces[0]?.id ?? '');

  // Until the user picks a branch, follow the requested default as workspaces load.
  const target =
    targetChoice ?? (workspaces.length > 0 ? (initialTarget ?? 'existing') : 'new');

  const chooseTarget = (next: 'existing' | 'new') => setTargetChoice(next);

  const workspaceOptions = workspaces.map((w) => ({
    label: `${w.name} (${w.projects.length} ${w.projects.length === 1 ? 'project' : 'projects'})`,
    value: w.id,
  }));

  const selectedWorkspace = workspaces.find((w) => w.id === existingId) ?? null;
  const workspaceLabel = target === 'existing' ? selectedWorkspace?.name ?? '' : newWorkspaceName.trim();
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  // Returns an error message for the current step, or null when it can continue.
  const validate = (): string | null => {
    if (step === 'workspace') {
      if (target === 'existing' && !selectedWorkspace) return 'Choose a workspace.';
      if (target === 'new' && !newWorkspaceName.trim()) return 'Name the new workspace.';
    }
    if (step === 'project' && !projectName.trim()) return 'Name the project.';
    return null;
  };

  const next = () => {
    const problem = validate();
    setError(problem);
    if (problem) return;
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1].id);
  };

  const back = () => {
    setError(null);
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1].id);
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onCreate({
        workspaceId: target === 'existing' ? existingId : null,
        workspaceName: workspaceLabel,
        projectName: projectName.trim(),
        template,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the project.');
      setSubmitting(false);
    }
  };

  const chosen = getTemplate(template);
  const isLast = step === 'review';

  return (
    <div
      className="lab-wiz-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="lab-wiz" role="dialog" aria-modal="true" aria-labelledby="lab-wiz-title">
        <header className="lab-wiz-head">
          <div className="lab-wiz-heading">
            <p className="lab-wiz-kicker">New project</p>
            <h2 id="lab-wiz-title" className="lab-wiz-title">Set up your project</h2>
          </div>
          <button type="button" className="lab-wiz-close" aria-label="Close" onClick={onClose} disabled={submitting}>
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <ol className="lab-wiz-steps" aria-label="Setup progress">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className={`lab-wiz-stepdot ${i === stepIndex ? 'is-current' : ''} ${i < stepIndex ? 'is-done' : ''}`}
              aria-current={i === stepIndex ? 'step' : undefined}
            >
              <span className="lab-wiz-stepnum">{i + 1}</span>
              <span className="lab-wiz-steplabel">{s.label}</span>
            </li>
          ))}
        </ol>

        <div className="lab-wiz-body">
          {step === 'workspace' && (
            <fieldset className="lab-wiz-fieldset">
              <legend className="lab-wiz-question">Where should the project go?</legend>
              {workspaces.length > 0 && (
                <label className={`lab-wiz-option ${target === 'existing' ? 'is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="target"
                    checked={target === 'existing'}
                    onChange={() => chooseTarget('existing')}
                  />
                  <span className="lab-wiz-option-text">
                    <span className="lab-wiz-option-title">Add to an existing workspace</span>
                    <span className="lab-wiz-option-sub">Keep it with related strategies.</span>
                  </span>
                </label>
              )}
              {target === 'existing' && workspaces.length > 0 && (
                <div className="lab-wiz-indent">
                  <Select
                    label="Workspace"
                    options={workspaceOptions}
                    value={existingId}
                    onChange={(value) => setExistingChoice(String(value))}
                  />
                </div>
              )}
              <label className={`lab-wiz-option ${target === 'new' ? 'is-selected' : ''}`}>
                <input type="radio" name="target" checked={target === 'new'} onChange={() => chooseTarget('new')} />
                <span className="lab-wiz-option-text">
                  <span className="lab-wiz-option-title">Create a new workspace</span>
                  <span className="lab-wiz-option-sub">A fresh folder for a new line of research.</span>
                </span>
              </label>
              {target === 'new' && (
                <div className="lab-wiz-indent">
                  <Input
                    label="Workspace name"
                    placeholder="e.g. Momentum research"
                    value={newWorkspaceName}
                    maxLength={NAME_MAX}
                    autoFocus
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                  />
                </div>
              )}
            </fieldset>
          )}

          {step === 'project' && (
            <div className="lab-wiz-stack">
              <p className="lab-wiz-question">What is this strategy called?</p>
              <Input
                label="Project name"
                placeholder="e.g. RSI pullback v1"
                value={projectName}
                maxLength={NAME_MAX}
                autoFocus
                onChange={(e) => setProjectName(e.target.value)}
              />
              <p className="lab-wiz-hint">
                Each project is one strategy file with its own editor. You can add helper files later.
              </p>
            </div>
          )}

          {step === 'template' && (
            <fieldset className="lab-wiz-fieldset">
              <legend className="lab-wiz-question">Where should the code start?</legend>
              <div className="lab-wiz-templates">
                {LAB_TEMPLATES.map((t) => {
                  const Icon = t.icon;
                  const selected = template === t.id;
                  return (
                    <label key={t.id} className={`lab-wiz-template ${selected ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="template"
                        value={t.id}
                        checked={selected}
                        onChange={() => setTemplate(t.id)}
                      />
                      <span className="lab-wiz-template-head">
                        <Icon size={15} aria-hidden="true" />
                        <span className="lab-wiz-template-name">{t.name}</span>
                      </span>
                      <span className="lab-wiz-template-summary">{t.summary}</span>
                      <pre className="lab-wiz-code" aria-hidden="true">{t.preview.join('\n')}</pre>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {step === 'review' && (
            <div className="lab-wiz-stack">
              <p className="lab-wiz-question">Check the setup, then create the project.</p>
              <dl className="lab-wiz-review">
                <div>
                  <dt>Workspace</dt>
                  <dd>
                    {workspaceLabel}
                    <span className="lab-wiz-tag">{target === 'existing' ? 'existing' : 'new'}</span>
                  </dd>
                </div>
                <div>
                  <dt>Project</dt>
                  <dd>{projectName.trim()}</dd>
                </div>
                <div>
                  <dt>Starting code</dt>
                  <dd>{chosen.name}</dd>
                </div>
              </dl>
              <pre className="lab-wiz-code lab-wiz-code-wide" aria-label="Starting code preview">
                {chosen.preview.join('\n')}
              </pre>
            </div>
          )}

          {error && <p className="lab-wiz-error" role="alert">{error}</p>}
        </div>

        <footer className="lab-wiz-foot">
          <Button variant="ghost" size="md" onClick={back} disabled={stepIndex === 0 || submitting}>
            Back
          </Button>
          {isLast ? (
            <Button variant="primary" size="md" onClick={() => void submit()} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create project'}
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={next}>
              Continue
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
