import { SESSION_RESOURCE_RETENTION_MS } from "pstdio-api-contracts";

export { SESSION_RESOURCE_RETENTION_MS } from "pstdio-api-contracts";

interface ResourceClock {
  now: () => number;
  schedule: (run: () => void, delay: number) => () => void;
  onError: (error: unknown) => void;
}

interface SessionResources {
  id: string;
  busy: number;
  lastUsed: number;
  release: () => Promise<boolean>;
  releasing?: Promise<void>;
}

// The host owns interest and inactivity. Providers decide how to release their own
// resources, and may defer when their native execution is not safely idle yet.
export const createHarnessSessionResources = (options: Partial<ResourceClock> = {}) => {
  const now = options.now ?? Date.now;
  const schedule =
    options.schedule ??
    ((run: () => void, delay: number) => {
      const timer = setTimeout(run, delay);
      timer.unref?.();
      return () => clearTimeout(timer);
    });
  const owners = new Map<object, Map<string, SessionResources>>();
  const interest = new Map<string, number>();
  let cancelTimer: (() => void) | undefined;

  const reschedule = () => {
    cancelTimer?.();
    cancelTimer = undefined;
    let next = Infinity;
    for (const sessions of owners.values()) {
      for (const entry of sessions.values()) {
        if (!entry.busy && !entry.releasing && !interest.has(entry.id))
          next = Math.min(next, entry.lastUsed + SESSION_RESOURCE_RETENTION_MS);
      }
    }
    if (Number.isFinite(next)) cancelTimer = schedule(expire, Math.max(0, next - now()));
  };

  const expire = () => {
    cancelTimer = undefined;
    for (const [owner, sessions] of owners) {
      for (const entry of sessions.values()) {
        if (entry.busy || entry.releasing || interest.has(entry.id)) continue;
        if (entry.lastUsed + SESSION_RESOURCE_RETENTION_MS > now()) continue;
        const release = entry.release;
        entry.releasing = Promise.resolve()
          .then(release)
          .then((released) => {
            if (released && !entry.busy && !interest.has(entry.id)) sessions.delete(entry.id);
          })
          .catch((error: unknown) => options.onError?.(error))
          .finally(() => {
            entry.releasing = undefined;
            // A provider reporting busy is activity too. Reconsider it after the
            // same grace period instead of retrying cleanup in a tight loop.
            entry.lastUsed = now();
            if (!sessions.size && owners.get(owner) === sessions) owners.delete(owner);
            reschedule();
          });
      }
    }
    reschedule();
  };

  return {
    acquire: async (owner: object, id: string, release: () => Promise<boolean>) => {
      let sessions = owners.get(owner);
      if (!sessions) {
        sessions = new Map();
        owners.set(owner, sessions);
      }
      let entry = sessions.get(id);
      if (!entry) {
        entry = { id, busy: 0, lastUsed: now(), release };
        sessions.set(id, entry);
      }
      entry.busy++;
      entry.release = release;
      reschedule();
      await entry.releasing;
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        entry.busy--;
        entry.lastUsed = now();
        reschedule();
      };
    },
    retain: (id: string) => {
      interest.set(id, (interest.get(id) ?? 0) + 1);
      reschedule();
      let retained = true;
      return () => {
        if (!retained) return;
        retained = false;
        const remaining = (interest.get(id) ?? 1) - 1;
        if (remaining) interest.set(id, remaining);
        else interest.delete(id);
        for (const sessions of owners.values()) {
          const entry = sessions.get(id);
          if (entry) entry.lastUsed = now();
        }
        reschedule();
      };
    },
    retire: async (owner: object) => {
      const sessions = owners.get(owner);
      owners.delete(owner);
      reschedule();
      await Promise.all([...(sessions?.values() ?? [])].map((entry) => entry.releasing));
    },
  };
};

export type HarnessSessionResources = ReturnType<typeof createHarnessSessionResources>;
