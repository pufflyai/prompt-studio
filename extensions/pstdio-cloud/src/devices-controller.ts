import type { AccountDevice, CloudDevice, CloudDeviceProvider, ExtensionAccountApi } from "@pstdio/sdk/extensions";

interface DevicesState {
  signedIn: boolean;
  accountId?: string;
  provider: CloudDeviceProvider;
  devices: CloudDevice[];
  accountDevices: AccountDevice[] | null;
  busy?: string;
  error?: string;
  elapsed?: number;
}

type DevicesAccount = Pick<ExtensionAccountApi, "status" | "cloudDeviceProvider" | "cloudDevices" | "devices">;
const requestMessage = (cause: unknown) => (cause instanceof Error ? cause.message : "Device request failed.");

export const createDevicesController = (account: DevicesAccount) => {
  let state: DevicesState = { signedIn: false, provider: { configured: false }, devices: [], accountDevices: [] };
  const listeners = new Set<() => void>();
  let running = false;
  let loadedAccountId: string | undefined;
  let refreshQueued = false;
  const publish = (change: Partial<DevicesState>) => {
    state = { ...state, ...change };
    for (const listener of listeners) listener();
  };
  const selectAccount = (accountId?: string) => {
    if (accountId === loadedAccountId) return;
    loadedAccountId = accountId;
    publish({
      accountId,
      signedIn: Boolean(accountId),
      provider: { configured: false },
      devices: [],
      accountDevices: [],
    });
  };
  const load = async () => {
    const status = await account.status();
    selectAccount(status.login?.accountId);
    if (!status.login) return;
    const [provider, devices, accountDevices] = await Promise.all([
      account.cloudDeviceProvider(),
      account.cloudDevices(),
      account.devices().catch(() => null),
    ]);
    const latest = await account.status();
    if (latest.login?.accountId !== status.login.accountId) {
      selectAccount(latest.login?.accountId);
      refreshQueued = true;
      return;
    }
    publish({ signedIn: true, provider, devices, accountDevices });
  };
  const run = async (label: string, action: () => Promise<unknown>) => {
    if (running) return;
    running = true;
    const started = Date.now();
    publish({ busy: label, error: undefined, elapsed: 0 });
    const clock = setInterval(() => publish({ elapsed: Math.floor((Date.now() - started) / 1000) }), 1000);
    let actionFailed = false;
    try {
      try {
        await action();
      } catch (cause) {
        actionFailed = true;
        publish({ error: requestMessage(cause) });
      }
      do {
        refreshQueued = false;
        try {
          await load();
        } catch (cause) {
          if (!actionFailed) publish({ error: requestMessage(cause) });
        }
      } while (refreshQueued);
    } finally {
      clearInterval(clock);
      running = false;
      publish({ busy: undefined, elapsed: Math.floor((Date.now() - started) / 1000) });
    }
  };
  return {
    get: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    run,
    refresh: () => {
      if (running) {
        refreshQueued = true;
        return Promise.resolve();
      }
      return run("Refreshing devices", async () => {});
    },
    dismiss: () => publish({ error: undefined }),
  };
};
