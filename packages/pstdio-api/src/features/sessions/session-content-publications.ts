import type { ActiveSession } from "./session-store";

/** All active-owner transcript and position publications share one recoverable order. */
export const publishSessionContent = <T>(entry: ActiveSession, action: () => Promise<T>) => {
  const pending = entry.contentPublications.then(action);
  entry.contentPublications = pending.catch(() => undefined);
  return pending;
};
