export interface ContentAutosaveOptions {
  save: (id: string, content: string) => void | Promise<void>;
  delayMs?: number;
}

// Save-on-edit engine, ported from the old dashboard's use-content-autosave:
// debounced saves, dirty tracking so a save never re-persists unchanged content,
// and a flush that fires the pending save immediately (used on teardown so
// navigating away never drops edits). Pure (no React) so it is unit-testable.
export const createContentAutosave = ({ save, delayMs = 400 }: ContentAutosaveOptions) => {
  let activeId: string | null = null;
  let draft = "";
  let saved = "";
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const persist = (id: string) => {
    if (draft === saved) return;
    saved = draft;
    void save(id, draft);
  };

  return {
    // Begin editing a resource. Switching to a different id flushes the previous
    // one first so its pending edits are never lost.
    reset(id: string, content: string) {
      if (activeId !== null && activeId !== id) {
        clearTimer();
        persist(activeId);
      }
      activeId = id;
      draft = content;
      saved = content;
    },
    change(content: string) {
      draft = content;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        if (activeId !== null) persist(activeId);
      }, delayMs);
    },
    flush() {
      clearTimer();
      if (activeId !== null) persist(activeId);
    },
  };
};
