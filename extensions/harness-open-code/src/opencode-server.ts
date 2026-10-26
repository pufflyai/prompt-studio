import { connect } from "node:net";
import type { HarnessStateApi } from "@pstdio/sdk/extensions";
import { isConnectionError } from "./opencode-http";
import type { OpencodeServer, OpencodeServerStarter } from "./opencode-server-process";

export type { OpencodeServerStarter } from "./opencode-server-process";
export { startOpencodeServer as defaultStartServer } from "./opencode-server-process";

export type OpencodeServerStore = {
  read: () => Promise<string | null>;
  write: (url: string) => Promise<void>;
  clear: () => Promise<void>;
};

export type OpencodeServerDeps = {
  reuseExisting?: boolean;
  startServer: OpencodeServerStarter;
  serverStore: OpencodeServerStore;
  pingServer: (url: string) => Promise<boolean>;
  isPortOpen: (options: { host: string; port: number }) => Promise<boolean>;
};

export type WithServerUrl = <T>(action: (url: string) => Promise<T>) => Promise<T>;

const defaultServerHost = "127.0.0.1";
const defaultServerPort = 4096;
const maxServerPortAttempts = 20;

const buildServerUrl = (host: string, port: number) => `http://${host}:${port}`;

export const createHarnessServerStore = (state: HarnessStateApi): OpencodeServerStore => ({
  read: async () => (await state.get<string>("serverUrl")) ?? null,
  write: (url) => state.set("serverUrl", url),
  clear: () => state.delete("serverUrl"),
});

export const canConnectToHost = ({ host, port }: { host: string; port: number }) =>
  new Promise<boolean>((resolve) => {
    const socket = connect({ host, port });

    const finish = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });

export const defaultPingServer = async (url: string) => {
  try {
    const healthUrl = new URL("/global/health", url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 750);

    try {
      const response = await fetch(healthUrl, { signal: controller.signal });
      if (!response.ok) return false;

      const payload = (await response.json()) as { healthy?: boolean } | null;
      return payload?.healthy === true;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
};

type Connection = { url: string; owned: OpencodeServer | null; replacement?: Promise<Connection> };

// The connection owns only the child it starts. A discovered server belongs to its caller.
export const createServerConnection = (deps: OpencodeServerDeps) => {
  const lifetime = new AbortController();
  let connection: Promise<Connection> | null = null;
  let closing: Promise<void> | undefined;
  let pendingStartup: AbortController | undefined;

  const clearStoredUrl = async (url: string) => {
    if ((await deps.serverStore.read()) === url) await deps.serverStore.clear();
  };

  const startOwned = async (port: number, signal: AbortSignal) => {
    const owned = await deps.startServer({ host: defaultServerHost, port, signal });
    try {
      signal.throwIfAborted();
      await deps.serverStore.write(owned.url);
      signal.throwIfAborted();
      return { url: owned.url, owned };
    } catch (error) {
      await owned.dispose();
      await clearStoredUrl(owned.url);
      throw error;
    }
  };

  const storedConnection = async () => {
    if (deps.reuseExisting === false) return null;
    const stored = await deps.serverStore.read();
    if (stored) {
      if (await deps.pingServer(stored)) return { url: stored, owned: null };
      await clearStoredUrl(stored);
    }
    return null;
  };

  const establish = async (signal: AbortSignal) => {
    signal.throwIfAborted();
    const stored = await storedConnection();
    if (stored) return stored;
    let lastError: unknown;
    for (let offset = 0; offset < maxServerPortAttempts; offset += 1) {
      signal.throwIfAborted();
      const port = defaultServerPort + offset;
      const url = buildServerUrl(defaultServerHost, port);
      if (await deps.isPortOpen({ host: defaultServerHost, port })) {
        if (deps.reuseExisting === false) continue;
        if (await deps.pingServer(url)) {
          await deps.serverStore.write(url);
          return { url, owned: null };
        }
        continue;
      }
      try {
        return await startOwned(port, signal);
      } catch (error) {
        signal.throwIfAborted();
        lastError = error;
      }
    }
    const suffix = lastError instanceof Error ? lastError.message : "";
    throw new Error(`Failed to start Opencode server on ports 4096-4115. ${suffix}`);
  };

  const connect = async (before?: () => Promise<void>) => {
    const startup = new AbortController();
    pendingStartup = startup;
    try {
      await before?.();
      return await establish(AbortSignal.any([lifetime.signal, startup.signal]));
    } finally {
      if (pendingStartup === startup) pendingStartup = undefined;
    }
  };

  const track = (pending: Promise<Connection>) => {
    const tracked = pending.catch((error: unknown) => {
      if (connection === tracked) connection = null;
      throw error;
    });
    connection = tracked;
    return tracked;
  };

  const withServerUrl: WithServerUrl = async (action) => {
    lifetime.signal.throwIfAborted();
    const pending = connection ?? track(connect());
    const current = await pending;
    lifetime.signal.throwIfAborted();
    try {
      return await action(current.url);
    } catch (error) {
      lifetime.signal.throwIfAborted();
      if (!isConnectionError(error)) throw error;
      current.replacement ??= track(
        connect(async () => {
          await current.owned?.dispose();
          await clearStoredUrl(current.url);
        }),
      );
      const replacement = await current.replacement;
      lifetime.signal.throwIfAborted();
      return action(replacement.url);
    }
  };

  const dispose = () =>
    (closing ??= (async () => {
      lifetime.abort();
      const current = await connection?.catch(() => null);
      if (current?.owned) {
        await current.owned.dispose();
        await clearStoredUrl(current.url);
      }
    })());

  return { withServerUrl, dispose, cancelPendingStartup: () => pendingStartup?.abort() };
};
