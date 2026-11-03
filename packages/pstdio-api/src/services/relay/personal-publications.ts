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
      timer ??= setTimeout(() => {
        timer = undefined;
        input.wake();
      }, 10_500);
    },
    async flush(full: boolean, captured: boolean) {
      const ordinary = heads.size > 0 && (full || captured || Date.now() - writtenAt > 10_000);
      if (!completed.size && !ordinary) return false;
      await input.history.writeHeads(new Map(heads), new Map(completed));
      heads.clear();
      completed.clear();
      writtenAt = Date.now();
      return true;
    },
    close() {
      clearTimeout(timer);
    },
  };
};
