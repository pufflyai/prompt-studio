import type { EventBus, SyncEvent } from "../features/sync/event-bus";

export const waitForSyncEvent = (eventBus: EventBus, predicate: (event: SyncEvent) => boolean, timeoutMs = 1_000) =>
  new Promise<SyncEvent>((resolve, reject) => {
    const bufferedMatch = eventBus.getSince(0).find(predicate);
    if (bufferedMatch) {
      resolve(bufferedMatch);
      return;
    }

    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for sync event within ${timeoutMs}ms`));
    }, timeoutMs);

    const unsubscribe = eventBus.subscribe((event) => {
      if (!predicate(event)) {
        return;
      }

      clearTimeout(timeout);
      unsubscribe();
      resolve(event);
    });
  });
