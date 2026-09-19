// Owns the editable file renderer's save lifecycle: the last loaded or saved
// value (the baseline), the debounced draft, the one in-flight save, and
// refresh events that arrive while a draft or save exists.
//
// Invariants (from the renderer edit/refresh lifecycle PRD):
// - a change equal to the baseline never schedules a save
// - at most one save runs at a time; the baseline advances when it succeeds
// - a failed save keeps the draft so a later change or flush retries it
// - refresh events are deferred while a draft or save exists and coalesce
//   into one reload after the last save settles

import type {
  FileRendererRefreshEnvelope,
  FileRendererRefreshOrigin,
  FileRendererSaveResult,
} from "../../../core/registries/renderers/file-renderer-registry";

export interface FileEditControllerState {
  dirty: boolean;
  saving: boolean;
  saveError?: string;
}

export interface FileEditControllerInput {
  binding: Omit<FileRendererRefreshOrigin, "operationId"> & { resourceKey?: string };
  debounceMs: number;
  load: (event?: FileRendererRefreshEnvelope) => void;
  save: (value: string, origin: FileRendererRefreshOrigin) => Promise<FileRendererSaveResult | undefined>;
  createOperationId?: () => string;
  onStateChange?: (state: FileEditControllerState) => void;
}

export type FileEditController = ReturnType<typeof createFileEditController>;

export const createFileEditController = (input: FileEditControllerInput) => {
  let baseline: string | undefined;
  let baselineRevision: string | undefined;
  let draft: string | null = null;
  let activeSave: { value: string; origin: FileRendererRefreshOrigin } | null = null;
  let saveError: string | undefined;
  let deferredRevision: string | undefined;
  let genericRefreshDeferred = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let operationSequence = 0;
  const seenRefreshRevisions = new Set<string>();
  const completedOperationIds = new Set<string>();

  const describeError = (error: unknown) => (error instanceof Error ? error.message : "Failed to save file.");
  const getState = (): FileEditControllerState => ({
    dirty: draft !== null || (activeSave !== null && activeSave.value !== baseline),
    saving: activeSave !== null,
    ...(saveError ? { saveError } : {}),
  });
  const notify = () => input.onStateChange?.(getState());

  const clearTimer = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const nextOperationId = () => input.createOperationId?.() ?? `file-save-${Date.now()}-${++operationSequence}`;

  const hasPendingLocalState = () => draft !== null || activeSave !== null || timer !== null || Boolean(saveError);

  const deferRefresh = (event: FileRendererRefreshEnvelope) => {
    if (event.revision && (!deferredRevision || event.revision.localeCompare(deferredRevision) > 0)) {
      deferredRevision = event.revision;
    }
    if (!event.revision) genericRefreshDeferred = true;
  };

  const isSelfRefresh = (event: FileRendererRefreshEnvelope) => {
    const operationId = event.origin?.operationId;
    if (!operationId) return false;
    if (event.origin?.rendererId !== input.binding.rendererId) return false;
    if (event.origin.instanceId !== input.binding.instanceId) return false;
    return activeSave?.origin.operationId === operationId || completedOperationIds.has(operationId);
  };

  const takeDeferredRefresh = (savedRevision?: string) => {
    if (draft !== null || activeSave) return;
    const revision = deferredRevision;
    const generic = genericRefreshDeferred;
    deferredRevision = undefined;
    genericRefreshDeferred = false;
    if (revision && (!savedRevision || revision.localeCompare(savedRevision) > 0)) {
      input.load({ resourceKey: input.binding.resourceKey, revision });
      return;
    }
    if (generic) input.load({ resourceKey: input.binding.resourceKey });
  };

  const runSave = () => {
    if (draft === null || activeSave || saveError) return;
    const value = draft;
    draft = null;
    const origin = {
      rendererId: input.binding.rendererId,
      instanceId: input.binding.instanceId,
      operationId: nextOperationId(),
    };
    activeSave = { value, origin };
    notify();
    void Promise.resolve(input.save(value, origin))
      .then((result) => {
        if (activeSave?.origin.operationId !== origin.operationId) return;
        activeSave = null;
        completedOperationIds.add(origin.operationId);
        if (completedOperationIds.size > 20) completedOperationIds.delete(completedOperationIds.values().next().value!);
        baseline = value;
        baselineRevision = result?.revision ?? baselineRevision;
        if (draft === baseline) {
          draft = null;
          clearTimer();
        }
        notify();
        if (draft !== null) {
          schedule();
          return;
        }
        takeDeferredRefresh(result?.revision);
      })
      .catch((error) => {
        if (activeSave?.origin.operationId !== origin.operationId) return;
        activeSave = null;
        if (draft === null) draft = value;
        saveError = describeError(error);
        notify();
      });
  };

  const schedule = () => {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      runSave();
    }, input.debounceMs);
  };

  return {
    getBaseline() {
      return baseline;
    },
    getState,
    setBaseline(value: string | undefined, revision?: string) {
      baseline = value;
      baselineRevision = revision;
      notify();
    },
    // Takes a freshly loaded value as the new baseline and returns the value the
    // editor was showing, so the caller can tell whether the editor must show
    // something else. Returns null while pending local state must keep the
    // editor: the refresh is deferred until the save settles.
    acceptLoaded(value: string | undefined, revision?: string) {
      if (hasPendingLocalState()) {
        deferRefresh(revision ? { revision } : {});
        return null;
      }
      const shown = baseline;
      baseline = value;
      baselineRevision = revision;
      notify();
      return { shown };
    },
    handleChange(value: string) {
      if (saveError && value === draft) return;
      saveError = undefined;
      if (value === baseline && !activeSave) {
        draft = null;
        clearTimer();
        notify();
        return;
      }
      if (activeSave?.value === value) {
        draft = null;
        clearTimer();
        notify();
        return;
      }
      draft = value;
      schedule();
      notify();
    },
    handleRefreshEvent(event: FileRendererRefreshEnvelope = {}) {
      if (event.resourceKey && event.resourceKey !== input.binding.resourceKey) return;
      if (isSelfRefresh(event)) return;
      if (event.revision && seenRefreshRevisions.has(event.revision)) return;
      if (event.revision) seenRefreshRevisions.add(event.revision);
      if (hasPendingLocalState()) {
        deferRefresh(event);
        return;
      }
      if (event.revision && baselineRevision && event.revision.localeCompare(baselineRevision) <= 0) return;
      input.load(event);
    },
    retry() {
      if (!saveError || draft === null || activeSave) return;
      saveError = undefined;
      notify();
      runSave();
    },
    retryLoad() {
      input.load({ resourceKey: input.binding.resourceKey });
    },
    flush() {
      clearTimer();
      runSave();
    },
  };
};
