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

export interface FileEditControllerInput {
  debounceMs: number;
  load: () => void;
  save: (value: string) => Promise<unknown>;
}

export type FileEditController = ReturnType<typeof createFileEditController>;

export const createFileEditController = (input: FileEditControllerInput) => {
  let baseline: string | undefined;
  let draft: string | null = null;
  let saving = false;
  let refreshDeferred = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const runSave = () => {
    if (draft === null || saving) return;
    const value = draft;
    draft = null;
    saving = true;
    void Promise.resolve(input.save(value))
      .then(
        () => {
          baseline = value;
          return true;
        },
        () => {
          // The file may not contain the draft; keep it unless newer edits exist.
          if (draft === null && value !== baseline) draft = value;
          return false;
        },
      )
      .then((saved) => {
        saving = false;
        if (draft !== null) {
          // A held failed draft retries on the next edit or flush, never on its
          // own timer, so a persistent failure cannot loop.
          if (saved) schedule();
          return;
        }
        if (!refreshDeferred) return;
        refreshDeferred = false;
        // Refresh events raised while our own save ran are self-invalidation:
        // the save already acknowledged this state, and reloading here pulls
        // server-normalized content that remounts the editor and drops focus.
        // Only a failed save leaves the document unknown and worth reloading.
        if (!saved) input.load();
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
    setBaseline(value: string | undefined) {
      baseline = value;
    },
    handleChange(value: string) {
      if (value === baseline && !saving) {
        draft = null;
        clearTimer();
        return;
      }
      draft = value;
      schedule();
    },
    handleRefreshEvent() {
      if (draft !== null || saving || timer !== null) {
        refreshDeferred = true;
        return;
      }
      input.load();
    },
    flush() {
      clearTimer();
      runSave();
    },
  };
};

// A reload that returns what the editor already shows must not remount it: the
// revision feeds the editor's React key, and a new key destroys focus and
// selection. `editorValue` is the current baseline for an editable renderer —
// after a save, a reload returns the saved value, which matches the baseline
// even though it differs from the previously loaded state.
export const nextLoadedRevision = (
  previous: { content?: string; dataUrl?: string; loadKey: string; revision: number } | null,
  next: { content?: string; dataUrl?: string },
  loadKey: string,
  editorValue?: string,
) => {
  if (!previous || previous.loadKey !== loadKey) return 1;
  const shownContent = editorValue ?? previous.content;
  if (shownContent === next.content && previous.dataUrl === next.dataUrl) return previous.revision;
  return previous.revision + 1;
};

// Last loaded document per binding, so reopening a recently viewed file mounts
// the editor immediately instead of a spinner. The follow-up load reconciles:
// unchanged content keeps the revision (no remount), changed content remounts.
const FILE_CONTENT_CACHE_LIMIT = 30;
const fileContentCache = new Map<
  string,
  { content?: string; dataUrl?: string; fileName?: string; mimeType?: string; placeholder?: string }
>();

export const readCachedFileContent = (loadKey: string) => fileContentCache.get(loadKey);

export const storeCachedFileContent = (
  loadKey: string,
  content: NonNullable<ReturnType<typeof readCachedFileContent>>,
) => {
  fileContentCache.delete(loadKey);
  fileContentCache.set(loadKey, content);
  if (fileContentCache.size <= FILE_CONTENT_CACHE_LIMIT) return;
  const oldest = fileContentCache.keys().next().value;
  if (oldest !== undefined) fileContentCache.delete(oldest);
};
