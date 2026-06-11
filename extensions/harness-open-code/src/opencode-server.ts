import { spawn } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { isConnectionError } from "./opencode-http";

export type OpencodeServerStarter = (options: { host: string; port: number }) => Promise<string>;

export type OpencodeServerStore = {
  read: () => Promise<string | null>;
  write: (url: string) => Promise<void>;
  clear: () => Promise<void>;
};

export type OpencodeServerDeps = {
  startServer: OpencodeServerStarter;
  serverStore: OpencodeServerStore;
  pingServer: (url: string) => Promise<boolean>;
  isPortOpen: (options: { host: string; port: number }) => Promise<boolean>;
};

export type WithServerUrl = <T>(action: (url: string) => Promise<T>) => Promise<T>;

const defaultServerHost = "127.0.0.1";
const defaultServerPort = 4096;
const maxServerPortAttempts = 20;

const resolveHome = () => process.env.HOME ?? process.env.USERPROFILE ?? homedir();

export const defaultServerStorePath = () => join(resolveHome(), ".pstdio", "opencode-server.txt");

const buildServerUrl = (host: string, port: number) => `http://${host}:${port}`;

export const createFileServerStore = (path: string): OpencodeServerStore => ({
  read: async () => {
    try {
      const raw = await readFile(path, "utf8");
      const value = raw.trim();
      return value.length > 0 ? value : null;
    } catch {
      return null;
    }
  },
  write: async (url: string) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${url}\n`, "utf8");
  },
  clear: async () => {
    try {
      await unlink(path);
    } catch {
      return;
    }
  },
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

const readServerUrl = (output: string) => {
  const trimmed = output.trim();
  if (!trimmed) return null;

  const prefix = "opencode server listening on ";
  if (trimmed.startsWith(prefix)) {
    return trimmed.slice(prefix.length).trim();
  }

  return null;
};

const waitForServerUrl = async (stdout: NodeJS.ReadableStream, stderr: NodeJS.ReadableStream) => {
  const reader = createInterface({ input: stdout });
  const errReader = createInterface({ input: stderr });
  let stderrTail = "";

  const collectError = (line: string) => {
    stderrTail = `${stderrTail}\n${line}`.trim().slice(-8000);
  };

  errReader.on("line", collectError);

  const url = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      const suffix = stderrTail ? `\n${stderrTail}` : "";
      reject(new Error(`Timed out waiting for Opencode server URL.${suffix}`));
    }, 120_000);

    reader.on("line", (line) => {
      const parsed = readServerUrl(line);
      if (parsed) {
        clearTimeout(timeout);
        resolve(parsed);
      }
    });

    reader.once("close", () => {
      clearTimeout(timeout);
      const suffix = stderrTail ? `\n${stderrTail}` : "";
      reject(new Error(`Opencode server exited before publishing its URL.${suffix}`));
    });
  });

  reader.close();
  errReader.close();

  return url;
};

export const defaultStartServer: OpencodeServerStarter = async ({ host, port }) => {
  const child = spawn("opencode", ["serve", "--hostname", host, "--port", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    const url = await new Promise<string>((resolve, reject) => {
      child.once("error", (error) => {
        reject(new Error(`Failed to start Opencode server: ${error.message}`));
      });

      if (!child.stdout || !child.stderr) {
        reject(new Error("Opencode server missing stdout/stderr streams."));
        return;
      }

      waitForServerUrl(child.stdout, child.stderr).then(resolve).catch(reject);
    });

    return url;
  } catch (error) {
    child.kill();
    throw error;
  }
};

// Resolves (and remembers) a reachable opencode server URL, starting a shared
// server when none is found, and retries actions once on connection errors.
export const createServerConnection = (deps: OpencodeServerDeps) => {
  let sharedServerPromise: Promise<string> | null = null;
  let cachedServerUrl: string | null = null;

  const toStartServerError = (error: unknown) =>
    error instanceof Error ? error : new Error("Failed to start Opencode server.");

  const resolveServerOnPort = async (port: number) => {
    const candidate = buildServerUrl(defaultServerHost, port);
    const portOpen = await deps.isPortOpen({ host: defaultServerHost, port });

    if (portOpen) {
      const healthy = await deps.pingServer(candidate);
      return healthy ? { url: candidate } : { url: null };
    }

    try {
      return { url: await deps.startServer({ host: defaultServerHost, port }) };
    } catch (error) {
      return { url: null, error: toStartServerError(error) };
    }
  };

  const findOrStartSharedServer = async () => {
    let lastError: Error | null = null;

    for (let offset = 0; offset < maxServerPortAttempts; offset += 1) {
      const port = defaultServerPort + offset;
      const result = await resolveServerOnPort(port);
      if (result.url) return result.url;
      if (result.error) lastError = result.error;
    }

    const maxPort = defaultServerPort + maxServerPortAttempts - 1;
    const suffix = lastError ? ` ${lastError.message}` : "";
    throw new Error(`Failed to start Opencode server on ports ${defaultServerPort}-${maxPort}.${suffix}`);
  };

  const ensureSharedServer = async () => {
    if (!sharedServerPromise) {
      sharedServerPromise = findOrStartSharedServer().catch((error) => {
        sharedServerPromise = null;
        throw error;
      });
    }

    return sharedServerPromise;
  };

  const resolveExistingServerUrl = async () => {
    if (cachedServerUrl) {
      const reachable = await deps.pingServer(cachedServerUrl);
      if (reachable) return cachedServerUrl;
      cachedServerUrl = null;
    }

    const stored = await deps.serverStore.read();

    if (!stored) {
      const defaultUrl = buildServerUrl(defaultServerHost, defaultServerPort);
      const reachable = await deps.pingServer(defaultUrl);

      if (reachable) {
        cachedServerUrl = defaultUrl;
        return defaultUrl;
      }

      return null;
    }

    const reachable = await deps.pingServer(stored);

    if (!reachable) {
      await deps.serverStore.clear();
      const defaultUrl = buildServerUrl(defaultServerHost, defaultServerPort);
      const fallbackReachable = await deps.pingServer(defaultUrl);

      if (fallbackReachable) {
        cachedServerUrl = defaultUrl;
        return defaultUrl;
      }

      return null;
    }

    cachedServerUrl = stored;
    return stored;
  };

  const rememberServerUrl = async (url: string) => {
    cachedServerUrl = url;
    await deps.serverStore.write(url);
    return url;
  };

  const ensureServerUrl = async () => {
    const existing = await resolveExistingServerUrl();
    if (existing) return { url: existing, started: false };

    const started = await ensureSharedServer();
    const url = await rememberServerUrl(started);
    return { url, started: true };
  };

  const startFreshServer = async () => {
    sharedServerPromise = null;
    const url = await ensureSharedServer();
    return rememberServerUrl(url);
  };

  const withServerUrl: WithServerUrl = async (action) => {
    const attachInfo = await ensureServerUrl();

    try {
      return await action(attachInfo.url);
    } catch (error) {
      if (attachInfo.started) throw error;
      if (!isConnectionError(error)) throw error;

      await deps.serverStore.clear();
      cachedServerUrl = null;
      const freshUrl = await startFreshServer();
      return action(freshUrl);
    }
  };

  return { withServerUrl };
};
