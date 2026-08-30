import { ApiError } from '../api/client.ts';
import type { WizardValues } from './types.ts';
import { mergeWizardValues } from './types.ts';

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';
export type AutosaveState = {
  status: AutosaveStatus;
  revision: number;
  error?: Error;
  savedAt?: Date;
};

type Options = {
  delayMs?: number;
  initialRevision: number;
  save: (patch: WizardValues, revision: number, signal: AbortSignal) => Promise<{ revisionNumber: number }>;
  onStateChange?: (state: AutosaveState) => void;
};

export type AutosaveController = {
  queue: (patch: WizardValues) => void;
  flush: () => Promise<void>;
  retry: () => Promise<void>;
  setRevision: (revision: number) => void;
  getState: () => AutosaveState;
  hasUnsavedChanges: () => boolean;
  dispose: () => void;
};

export const createAutosaveController = ({
  delayMs = 700,
  initialRevision,
  save,
  onStateChange,
}: Options): AutosaveController => {
  let state: AutosaveState = { status: 'idle', revision: initialRevision };
  let pending: WizardValues | undefined;
  let failed: WizardValues | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  let abort: AbortController | undefined;
  let disposed = false;
  const update = (next: AutosaveState) => {
    state = next;
    onStateChange?.(state);
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void flush(); }, delayMs);
  };
  const flush = async (): Promise<void> => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (inFlight) await inFlight;
    if (failed && (state.status === 'error' || state.status === 'conflict')) return;
    if (disposed || !pending) return;
    const patch = pending;
    pending = undefined;
    abort = new AbortController();
    update({ status: 'saving', revision: state.revision });
    inFlight = (async () => {
      try {
        const result = await save(patch, state.revision, abort!.signal);
        failed = undefined;
        update({ status: 'saved', revision: result.revisionNumber, savedAt: new Date() });
      } catch (error) {
        if (abort?.signal.aborted || disposed) return;
        failed = patch;
        update({
          status: error instanceof ApiError && error.code === 'STALE_REVISION' ? 'conflict' : 'error',
          revision: state.revision,
          error: error instanceof Error ? error : new Error('Falha ao salvar.'),
        });
      } finally {
        inFlight = undefined;
        abort = undefined;
        if (pending && !disposed && state.status === 'saved') schedule();
      }
    })();
    await inFlight;
  };
  return {
    queue(patch) {
      pending = mergeWizardValues(pending ?? {}, patch);
      update({ status: 'pending', revision: state.revision });
      if (!inFlight) schedule();
    },
    flush,
    async retry() {
      if (failed) {
        pending = mergeWizardValues(failed, pending ?? {});
        failed = undefined;
      }
      await flush();
    },
    setRevision(revision) { state = { ...state, revision }; },
    getState: () => state,
    hasUnsavedChanges: () => Boolean(pending || failed || inFlight),
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      abort?.abort();
    },
  };
};
