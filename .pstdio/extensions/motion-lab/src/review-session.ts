import type { ReviewChange, ReviewState } from "./review-state";
import { applyReviewChange } from "./review-state";

interface ReviewSessionOptions {
  read: () => Promise<ReviewState>;
  write: (change: ReviewChange) => Promise<ReviewState>;
  onState: (state: ReviewState) => void;
  onError: (reason: unknown) => void;
}

// Each mounted resource owns one session. Reads after writes reconcile all views
// against storage, rather than choosing between potentially stale command results.
export const createReviewSession = (initial: ReviewState, options: ReviewSessionOptions) => {
  let state = initial;
  let active = true;
  let readVersion = 0;
  let pending = 0;
  let queue = Promise.resolve();
  const publish = (next: ReviewState) => {
    if (!active) return;
    state = next;
    options.onState(next);
  };
  const refresh = async () => {
    if (!active || pending > 0) return;
    const version = ++readVersion;
    try {
      const next = await options.read();
      if (active && version === readVersion && pending === 0) publish(next);
    } catch (reason) {
      if (active && version === readVersion) options.onError(reason);
    }
  };
  const preview = (change: ReviewChange) => {
    readVersion += 1;
    publish(applyReviewChange(state, change, Date.now()));
  };
  const update = (change: ReviewChange) => {
    pending += 1;
    preview(change);
    queue = queue.then(async () => {
      try {
        await options.write(change);
      } catch (reason) {
        if (active) options.onError(reason);
      } finally {
        pending -= 1;
        // Broadcasts during pending writes are covered by this authoritative read.
        await refresh();
      }
    });
    return queue;
  };
  return {
    refresh,
    preview,
    update,
    dispose: () => {
      active = false;
      readVersion += 1;
    },
  };
};
