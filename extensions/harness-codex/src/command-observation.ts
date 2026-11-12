interface CommandObservationInput {
  covered: () => boolean;
  read: (signal: AbortSignal) => Promise<string>;
  changed: () => void;
  schedule?: (run: () => void) => () => void;
}

const scheduleRecovery = (run: () => void) => {
  const timer = setTimeout(run, 30_000);
  timer.unref?.();
  return () => clearTimeout(timer);
};

/** ADR 0141: an unclaimed thread has no passive native subscription. Never resume it for observation. */
export const createCodexCommandObservation = (input: CommandObservationInput) => {
  let closed = false;
  let running = false;
  let previous: string | undefined;
  let cancelTimer: (() => void) | undefined;
  const controller = new AbortController();
  const schedule = () => {
    if (closed || running || cancelTimer || input.covered()) return;
    cancelTimer = (input.schedule ?? scheduleRecovery)(() => {
      cancelTimer = undefined;
      void probe();
    });
  };
  const notify = () => {
    try {
      input.changed();
    } catch (error) {
      console.warn("Codex command state observer failed", error);
    }
  };
  const probe = async () => {
    if (closed || running || input.covered()) return;
    running = true;
    try {
      const next = await input.read(controller.signal);
      if (!closed && !input.covered() && previous !== next) {
        previous = next;
        notify();
      }
    } catch {
      // The finite command read owns user-visible failures and explicit recovery.
      if (!closed) notify();
    } finally {
      running = false;
      schedule();
    }
  };
  void probe();
  return {
    changed: () => {
      if (closed) return;
      cancelTimer?.();
      cancelTimer = undefined;
      schedule();
      notify();
    },
    close: () => {
      closed = true;
      cancelTimer?.();
      cancelTimer = undefined;
      controller.abort();
    },
  };
};

export const createCodexCommandObservers = <T extends { env?: Record<string, string> }>(source: {
  key: (input: T) => string;
  covered: (input: T) => boolean;
  read: (input: T, signal: AbortSignal) => Promise<string>;
}) => {
  const owners = new Map<
    string,
    {
      input: T;
      listeners: Set<() => void>;
      observation: ReturnType<typeof createCodexCommandObservation>;
    }
  >();
  return {
    changed: (key: string) => owners.get(key)?.observation.changed(),
    observe: (input: T, changed: () => void) => {
      const key = source.key(input);
      let owner = owners.get(key);
      if (!owner) {
        const listeners = new Set<() => void>();
        const observation = createCodexCommandObservation({
          covered: () => source.covered(input),
          read: (signal) => source.read(input, signal),
          changed: () => {
            for (const listener of [...listeners]) {
              try {
                listener();
              } catch (error) {
                console.warn("Codex command state observer failed", error);
              }
            }
          },
        });
        owner = { input, listeners, observation };
        owners.set(key, owner);
      }
      const token = () => changed();
      owner.listeners.add(token);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        owner.listeners.delete(token);
        if (!owner.listeners.size) {
          owner.observation.close();
          if (owners.get(key) === owner) owners.delete(key);
        }
      };
    },
    close: (projectId?: string, all = false) => {
      for (const [key, owner] of owners) {
        if (!all && owner.input.env?.PSTDIO_PROJECT_ID !== projectId) continue;
        owners.delete(key);
        owner.observation.close();
        owner.listeners.clear();
      }
    },
  };
};

export const readCodexCommandFingerprint = async (
  request: (method: string, params: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>,
  threadId: string,
  signal: AbortSignal,
) => {
  const goal = await request("thread/goal/get", { threadId }, signal);
  signal.throwIfAborted();
  const { thread } = (await request("thread/read", { threadId, includeTurns: false }, signal)) as {
    thread: { updatedAt?: number; status?: unknown; model?: string | null };
  };
  signal.throwIfAborted();
  const latest = (await request(
    "thread/turns/list",
    { threadId, limit: 1, sortDirection: "desc", itemsView: "notLoaded" },
    signal,
  )) as {
    data?: Array<{ id: string; status: string }>;
  };
  return JSON.stringify([
    goal,
    thread.updatedAt,
    thread.status,
    thread.model,
    latest.data?.map(({ id, status }) => [id, status]),
  ]);
};
