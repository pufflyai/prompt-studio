import { apiLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";

type Account = Pick<SessionsRouteDeps["accountService"], "status" | "devices" | "watch">;
type Status = Awaited<ReturnType<Account["status"]>>;
type Devices = Awaited<ReturnType<Account["devices"]>>;
const authority = (status: Status) => JSON.stringify([status.login?.accountId, status.login?.managerOrigin]);
const probes = new WeakMap<Account, ReturnType<typeof createProbe>>();

// Account Manager has no peer-presence subscription. One probe serves every observed remote session.
// Local session watches never acquire this owner. See ADR 0141.
const createProbe = (account: Account, retired: () => void) => {
  const listeners = new Set<() => void>();
  let current: { authority: string; devices: Devices; signature: string } | undefined;
  let pending: Promise<void> | undefined;
  let dirty = false;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const notify = () => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (err) {
        apiLogger.warn({ err, event: "session.availability.observer_failed" }, "Session availability observer failed");
      }
    }
  };
  const update = async () => {
    const status = await account.status();
    if (closed) return;
    const key = authority(status);
    if (current && current.authority !== key) {
      current = undefined;
      notify();
    }
    const devices = status.login ? await account.devices().catch(() => []) : [];
    if (closed) return;
    if (key !== authority(await account.status())) {
      dirty = true;
      return;
    }
    const signature = JSON.stringify(devices.map(({ id, name, online }) => ({ id, name, online })));
    const changed = current && (current.authority !== key || current.signature !== signature);
    current = { authority: key, devices, signature };
    if (changed) notify();
  };
  const refresh = () => {
    dirty = true;
    if (pending || closed) return pending ?? Promise.resolve();
    clearTimeout(timer);
    pending = (async () => {
      while (dirty && !closed) {
        dirty = false;
        await update();
      }
    })().finally(() => {
      pending = undefined;
      if (!closed)
        timer = setTimeout(() => {
          void refresh().catch(() => {});
        }, 2000);
    });
    return pending;
  };
  const stopAccount = account.watch(() => {
    // Revoke synchronously, before an older device request can be accepted by a reader.
    current = undefined;
    void refresh().catch(() => {});
    notify();
  });
  return {
    async read(status: Status) {
      if (pending) await pending;
      return current?.authority === authority(status) ? current.devices : [];
    },
    observe(listener: () => void) {
      listeners.add(listener);
      let released = false;
      const close = () => {
        if (released) return;
        released = true;
        listeners.delete(listener);
        if (listeners.size) return;
        closed = true;
        clearTimeout(timer);
        stopAccount();
        current = undefined;
        retired();
      };
      const ready = (current ? Promise.resolve() : (pending ?? refresh())).catch((error) => {
        close();
        throw error;
      });
      return { ready, close };
    },
  };
};

export const readObservedSessionDevices = async (account: Account, status: Status) => {
  const devices = await (probes.get(account)?.read(status) ?? account.devices().catch(() => []));
  return authority(status) === authority(await account.status()) ? devices : [];
};

export const observeSessionAvailability = (account: Account, listener: () => void) => {
  let probe = probes.get(account);
  if (!probe) {
    probe = createProbe(account, () => probes.delete(account));
    probes.set(account, probe);
  }
  return probe.observe(listener);
};
