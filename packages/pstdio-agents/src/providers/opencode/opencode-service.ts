import { spawn } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import type { OpencodeSessionMessage } from "./opencode-types";

type OpencodeFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type OpencodeServerStarter = (options: { host: string; port: number }) => Promise<string>;
type OpencodeServerStore = {
  read: () => Promise<string | null>;
  write: (url: string) => Promise<void>;
  clear: () => Promise<void>;
};

type OpencodeServiceDeps = {
  startServer: OpencodeServerStarter;
  serverStore: OpencodeServerStore;
  pingServer: (url: string) => Promise<boolean>;
  isPortOpen: (options: { host: string; port: number }) => Promise<boolean>;
  fetcher: OpencodeFetcher;
};

type OpencodeSessionStartInput = {
  prompt: string;
  title?: string;
  model?: string | null;
  cwd?: string;
};

type OpencodeSessionStartResult = {
  sessionId: string;
  messageComplete: Promise<void>;
};

type OpencodeSessionMessageInput = {
  sessionId: string;
  prompt: string;
  model?: string | null;
  cwd?: string;
};

type OpencodeModelInput = {
  providerID: string;
  modelID: string;
};

const defaultServerHost = "127.0.0.1";
const defaultServerPort = 4096;
const maxServerPortAttempts = 20;
const resolveHome = () => process.env.HOME ?? process.env.USERPROFILE ?? homedir();

const defaultServerStorePath = () => join(resolveHome(), ".pstdio", "opencode-server.txt");

const buildServerUrl = (host: string, port: number) => `http://${host}:${port}`;

const buildRequestUrl = (baseUrl: string, path: string, directory: string) => {
  const url = new URL(path, baseUrl);
  url.searchParams.set("directory", directory);
  return url.toString();
};

const buildHeaders = (directory: string) => ({
  "content-type": "application/json",
  "x-opencode-directory": directory,
});

const parseJsonValue = (value: string) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const toOpencodeModelInput = (model?: string | null) => {
  const trimmedModel = model?.trim();
  if (!trimmedModel) return undefined;

  const slashIndex = trimmedModel.indexOf("/");
  if (slashIndex <= 0 || slashIndex === trimmedModel.length - 1) return undefined;

  const providerID = trimmedModel.slice(0, slashIndex).trim();
  const modelID = trimmedModel.slice(slashIndex + 1).trim();

  if (!providerID || !modelID) return undefined;

  return { providerID, modelID } satisfies OpencodeModelInput;
};

const requestJson = async <T>(
  fetcher: OpencodeFetcher,
  url: string,
  options: { method: string; headers: Record<string, string>; body?: unknown },
) => {
  const response = await fetcher(url, {
    method: options.method,
    headers: options.headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const parsed = text.trim() ? (parseJsonValue(text) as T | null) : null;

  return { response, text, parsed };
};

const requireResponseOk = (response: Response, text: string, message: string) => {
  if (response.ok) return;

  const suffix = text.trim() ? ` ${text.trim()}` : "";
  throw new Error(`${message}: HTTP ${response.status}${suffix}`);
};

const parsePromptResponse = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return;

  const parsed = parseJsonValue(trimmed);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`OpenCode session.prompt returned unexpected response: ${trimmed}`);
  }

  const record = parsed as Record<string, unknown>;

  if (record.info && record.parts) return;

  if (typeof record.name === "string") {
    const data = record.data as { message?: string } | undefined;
    const message = data?.message ?? trimmed;
    throw new Error(`OpenCode session.prompt failed: ${record.name}: ${message}`);
  }

  throw new Error(`OpenCode session.prompt returned unexpected response: ${trimmed}`);
};

// --- Server lifecycle ---

const createFileServerStore = (path: string): OpencodeServerStore => ({
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

const canConnectToHost = ({ host, port }: { host: string; port: number }) =>
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

const defaultPingServer = async (url: string) => {
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

const defaultStartServer: OpencodeServerStarter = async ({ host, port }) => {
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

// --- Service factory ---

export const createOpencodeService = (overrides: Partial<OpencodeServiceDeps> = {}) => {
  const deps: OpencodeServiceDeps = {
    startServer: overrides.startServer ?? defaultStartServer,
    serverStore: overrides.serverStore ?? createFileServerStore(defaultServerStorePath()),
    pingServer: overrides.pingServer ?? defaultPingServer,
    isPortOpen: overrides.isPortOpen ?? canConnectToHost,
    fetcher: overrides.fetcher ?? fetch,
  };

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

  const withServerUrl = async <T>(action: (url: string) => Promise<T>) => {
    const attachInfo = await ensureServerUrl();

    try {
      return await action(attachInfo.url);
    } catch (error) {
      if (attachInfo.started) throw error;

      await deps.serverStore.clear();
      cachedServerUrl = null;
      const freshUrl = await startFreshServer();
      return action(freshUrl);
    }
  };

  const postSessionMessage = async (
    baseUrl: string,
    sessionId: string,
    directory: string,
    prompt: string,
    model?: string | null,
  ) => {
    const headers = buildHeaders(directory);
    const selectedModel = toOpencodeModelInput(model);
    const messageUrl = buildRequestUrl(baseUrl, `/session/${sessionId}/message`, directory);

    const messageResponse = await requestJson<Record<string, unknown>>(deps.fetcher, messageUrl, {
      method: "POST",
      headers,
      body: {
        parts: [{ type: "text", text: prompt }],
        ...(selectedModel ? { model: selectedModel } : {}),
      },
    });

    requireResponseOk(messageResponse.response, messageResponse.text, "OpenCode session.prompt failed");
    parsePromptResponse(messageResponse.text);
  };

  const startSession = async (input: OpencodeSessionStartInput): Promise<OpencodeSessionStartResult> => {
    const mockSessionId = (() => {
      const fixed = process.env.OPENCODE_MOCK_SESSION_ID?.trim();
      if (fixed) return fixed;

      const prefix = process.env.OPENCODE_MOCK_SESSION_ID_PREFIX?.trim();
      if (prefix) return `${prefix}${crypto.randomUUID()}`;

      return null;
    })();

    if (mockSessionId) {
      return { sessionId: mockSessionId, messageComplete: Promise.resolve() };
    }

    const title = input.title?.trim();
    const prompt = input.prompt.trim() || title || "New session";
    const directory = input.cwd?.trim() || process.cwd();

    const createAndPrompt = async (baseUrl: string) => {
      const headers = buildHeaders(directory);
      const createUrl = buildRequestUrl(baseUrl, "/session", directory);

      const createResponse = await requestJson<{ id?: string }>(deps.fetcher, createUrl, {
        method: "POST",
        headers,
        body: { model: input.model?.trim() || undefined },
      });

      requireResponseOk(createResponse.response, createResponse.text, "OpenCode session.create failed");

      const sessionId = createResponse.parsed?.id;
      if (!sessionId) throw new Error("Opencode session id not found.");

      const messageComplete = postSessionMessage(baseUrl, sessionId, directory, prompt).catch((error) => {
        console.warn(
          `[opencode:startSession] message failed for session ${sessionId}:`,
          error instanceof Error ? error.message : error,
        );
      });

      return { sessionId, messageComplete };
    };

    return withServerUrl(createAndPrompt);
  };

  const sendSessionMessage = (input: OpencodeSessionMessageInput) => {
    const directory = input.cwd?.trim() || process.cwd();
    const prompt = input.prompt.trim();

    const messageComplete = withServerUrl((baseUrl) =>
      postSessionMessage(baseUrl, input.sessionId, directory, prompt, input.model),
    ).catch((error) => {
      console.warn(
        `[opencode:sendSessionMessage] message failed for session ${input.sessionId}:`,
        error instanceof Error ? error.message : error,
      );
    });

    return { messageComplete };
  };

  const getSessionMessages = async (sessionId: string, cwd?: string) => {
    const directory = cwd?.trim() || process.cwd();

    const fetchMessages = async (baseUrl: string) => {
      const headers = buildHeaders(directory);
      const url = buildRequestUrl(baseUrl, `/session/${sessionId}/message`, directory);

      const { response, text, parsed } = await requestJson<OpencodeSessionMessage[]>(deps.fetcher, url, {
        method: "GET",
        headers,
      });

      requireResponseOk(response, text, "OpenCode getSessionMessages failed");

      if (!parsed || !Array.isArray(parsed)) return [];

      return parsed as OpencodeSessionMessage[];
    };

    return withServerUrl(fetchMessages);
  };

  return { startSession, sendSessionMessage, getSessionMessages };
};
