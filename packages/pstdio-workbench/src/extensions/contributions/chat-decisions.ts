import type { ChatRendererSnapshot } from "@pstdio/sdk/extensions";

/** A revision is dismissed only within this view owner; reload and unregister create a fresh owner. */
export const createChatDecisions = (initial: ChatRendererSnapshot = {}) => {
  const dismissed = new Set<string>();
  const reopenedAt = new Map<string, number>();
  let offered = initial.decisions ?? [];
  return (
    current: ChatRendererSnapshot,
    snapshot: ChatRendererSnapshot,
    dismissId?: string,
    reopen = false,
    issued = 0,
  ) => {
    if (snapshot.decisions) offered = snapshot.decisions;
    const dismiss = dismissId && (reopenedAt.get(dismissId) ?? -1) <= issued ? dismissId : undefined;
    if (dismiss) dismissed.add(dismiss);
    const explicit = snapshot.decision;
    if (reopen && explicit) {
      dismissed.delete(explicit.id);
      reopenedAt.set(explicit.id, issued);
    }
    if (snapshot.decisions === undefined && explicit === undefined && !dismiss) return snapshot;
    if (explicit && !dismissed.has(explicit.id)) return snapshot;
    const available = offered.filter((decision) => !dismissed.has(decision.id));
    const decision = available.find((decision) => decision.id === current.decision?.id) ?? available[0] ?? null;
    return { ...snapshot, decision };
  };
};
