import type { SessionLogPublication } from "../personal-history/log-publication";
import type { PersonalHistoryStore } from "../personal-history/store";

/** Batches ordinary log heads; a terminal row's publication proof is flushed immediately. */
export const createPersonalPublications = (input: {
  history: PersonalHistoryStore;
  published: (sessionId: string) => void;
  wake: () => void;
}) => {
  const heads = new Map<string, number>();
  const completed = new Map<string, SessionLogPublication>();
  let writtenAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    pending: () => heads.size > 0 || completed.size > 0,
    published(sessionId: string, head: number, version?: string) {
      if (head) heads.set(sessionId, head);
      if (version) completed.set(sessionId, { head, version });
      input.published(sessionId);
      if (version) input.wake();
      timer ??= setTimeout(() => {
        timer = undefined;
        input.wake();
      }, 60_000);
    },
    async flush(full: boolean, captured: boolean) {
      const ordinary = heads.size > 0 && (full || captured || Date.now() - writtenAt >= 60_000);
      if (!completed.size && !ordinary) return false;
      const writingHeads = new Map(heads);
      const writingCompleted = new Map(completed);
      await input.history.writeHeads(writingHeads, writingCompleted);
      for (const [id, head] of writingHeads) if (heads.get(id) === head) heads.delete(id);
      for (const [id, proof] of writingCompleted) if (completed.get(id) === proof) completed.delete(id);
      writtenAt = Date.now();
      if (!heads.size && !completed.size) {
        clearTimeout(timer);
        timer = undefined;
      }
      return true;
    },
    close() {
      clearTimeout(timer);
    },
  };
};
