export type RecoveryScanReason = "startup" | "reconnect" | "change" | "watcher-lost" | "explicit";

/** Watch notifications are hints. Startup, reconnect, watcher loss and an explicit
 * request run a full scan promptly; change hints wait for a quiet period. */
export const createRecoveryScheduler = (input: {
  run: (reasons: RecoveryScanReason[], signal: AbortSignal) => Promise<void>;
  watch: (changed: () => void, lost: () => void) => { close(): void };
  /** A burst of changes ends this long after its last hint. */
  quietMs?: number;
  /** Change-driven scans start at least this long after the previous scan ended. */
  gapMs?: number;
  retryMs?: number;
}) => {
  const quietMs = input.quietMs ?? 2_000;
  const gapMs = input.gapMs ?? 30_000;
  const retryMs = input.retryMs ?? 5_000;
  const controller = new AbortController();
  const reasons = new Set<RecoveryScanReason>();
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watcher: { close(): void } | undefined;
  let burstStartedAt: number | undefined;
  let lastEnded = Number.NEGATIVE_INFINITY;
  let failures = 0;
  let closed = false;

  const stopWatching = () => {
    watcher?.close();
    watcher = undefined;
  };
  const startWatching = () => {
    if (watcher) return;
    watcher = input.watch(
      () => request("change"),
      () => {
        stopWatching();
        request("watcher-lost");
      },
    );
  };
  const delay = () => {
    if (failures) return Math.min(retryMs * 2 ** (failures - 1), 5 * 60_000);
    if ([...reasons].some((reason) => reason !== "change")) return 0;
    const now = Date.now();
    burstStartedAt ??= now;
    const settled = Math.min(now + quietMs, burstStartedAt + 10 * quietMs);
    return Math.max(settled, lastEnded + gapMs) - now;
  };
  const schedule = () => {
    if (closed || running || !reasons.size) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      execute();
    }, delay());
  };
  const execute = () => {
    if (closed || running || !reasons.size) return;
    const batch = [...reasons];
    reasons.clear();
    burstStartedAt = undefined;
    running = (async () => {
      try {
        // Watch before reading so a change during the scan requests another one.
        startWatching();
        await input.run(batch, controller.signal);
        failures = 0;
      } catch {
        if (closed) return;
        for (const reason of batch) reasons.add(reason);
        failures++;
      } finally {
        lastEnded = Date.now();
      }
    })().finally(() => {
      running = undefined;
      schedule();
    });
  };
  function request(reason: RecoveryScanReason) {
    if (closed) return;
    reasons.add(reason);
    // A failed scan keeps its backoff unless a person asks for a backup now.
    if (reason === "explicit") failures = 0;
    schedule();
  }
  return {
    request,
    status: () => ({ running: !!running, pending: reasons.size > 0, failed: failures > 0 }),
    async close() {
      closed = true;
      clearTimeout(timer);
      controller.abort(new Error("Folder recovery stopped"));
      stopWatching();
      await running;
    },
  };
};
