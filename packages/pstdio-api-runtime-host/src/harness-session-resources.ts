import { SESSION_RESOURCE_RETENTION_MS } from "pstdio-api-contracts";
import { createSessionResourceDeadlines } from "./session-resource-deadlines";

export { SESSION_RESOURCE_RETENTION_MS } from "pstdio-api-contracts";

interface ResourceClock {
  now: () => number;
  schedule: (run: () => void, delay: number) => () => void;
  onError: (error: unknown) => void;
}

interface SessionResources {
  id: string;
  owner: object;
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
  const bySession = new Map<string, Set<SessionResources>>();
  const interest = new Map<string, number>();
  const deadlines = createSessionResourceDeadlines<SessionResources>();
  let cancelTimer: (() => void) | undefined;
  let timerAt: number | undefined;

  const reschedule = () => {
    const next = deadlines.first()?.at;
    if (timerAt === next) return;
    cancelTimer?.();
    cancelTimer = undefined;
    timerAt = next;
    if (next !== undefined) cancelTimer = schedule(expire, Math.max(0, next - now()));
  };

  const update = (entry: SessionResources) => {
    if (entry.busy || entry.releasing || interest.has(entry.id) || owners.get(entry.owner)?.get(entry.id) !== entry)
      deadlines.delete(entry);
    else deadlines.set(entry, entry.lastUsed + SESSION_RESOURCE_RETENTION_MS);
  };

  const remove = (entry: SessionResources) => {
    const sessions = owners.get(entry.owner);
    if (sessions?.get(entry.id) === entry) {
      sessions.delete(entry.id);
      if (!sessions.size) owners.delete(entry.owner);
    }
    const entries = bySession.get(entry.id);
    entries?.delete(entry);
    if (!entries?.size) bySession.delete(entry.id);
    deadlines.delete(entry);
  };

  const expire = () => {
    cancelTimer = undefined;
    timerAt = undefined;
    let next = deadlines.first();
    while (next && next.at <= now()) {
      const entry = next.value;
      deadlines.delete(entry);
      const release = entry.release;
      entry.releasing = Promise.resolve()
        .then(release)
        .then((released) => {
          if (released && !entry.busy && !interest.has(entry.id)) remove(entry);
        })
        .catch((error: unknown) => options.onError?.(error))
        .finally(() => {
          entry.releasing = undefined;
          // A provider reporting busy is activity too. Reconsider it after the
          // same grace period instead of retrying cleanup in a tight loop.
          entry.lastUsed = now();
          update(entry);
          reschedule();
        });
      next = deadlines.first();
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
        entry = { id, owner, busy: 0, lastUsed: now(), release };
        sessions.set(id, entry);
        let entries = bySession.get(id);
        if (!entries) {
          entries = new Set();
          bySession.set(id, entries);
        }
        entries.add(entry);
      }
      entry.busy++;
      entry.release = release;
      update(entry);
      reschedule();
      await entry.releasing;
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        entry.busy--;
        entry.lastUsed = now();
        update(entry);
        reschedule();
      };
    },
    retain: (id: string) => {
      interest.set(id, (interest.get(id) ?? 0) + 1);
      for (const entry of bySession.get(id) ?? []) update(entry);
      reschedule();
      let retained = true;
      return () => {
        if (!retained) return;
        retained = false;
        const remaining = (interest.get(id) ?? 1) - 1;
        if (remaining) interest.set(id, remaining);
        else interest.delete(id);
        for (const entry of bySession.get(id) ?? []) {
          entry.lastUsed = now();
          update(entry);
        }
        reschedule();
      };
    },
    retire: async (owner: object) => {
      const sessions = owners.get(owner);
      owners.delete(owner);
      for (const entry of sessions?.values() ?? []) remove(entry);
      reschedule();
      await Promise.all([...(sessions?.values() ?? [])].map((entry) => entry.releasing));
    },
  };
};

export type HarnessSessionResources = ReturnType<typeof createHarnessSessionResources>;
