import {
  buildHeaders,
  buildRequestUrl,
  buildServerUrl,
  canConnectToHost,
  createFileServerStore,
  defaultPingServer,
  defaultServerHost,
  defaultServerPort,
  defaultServerStorePath,
  defaultStartServer,
  isConnectionError,
  isTransportTimeout,
  maxServerPortAttempts,
  type OpencodeFetcher,
  type OpencodeServerStarter,
  type OpencodeServerStore,
  parsePromptResponse,
  requestJson,
  requireResponseOk,
  toOpencodeModelInput,
} from "./opencode-service-internals";
import type { OpencodeSessionMessage } from "./opencode-types";

export { isTransportTimeout };

type OpencodeServiceDeps = {
  startServer: OpencodeServerStarter;
  serverStore: OpencodeServerStore;
  pingServer: (url: string) => Promise<boolean>;
  isPortOpen: (options: { host: string; port: number }) => Promise<boolean>;
  fetcher: OpencodeFetcher;
};

type OpencodeSessionStartInput = {
  prompt: string;
  attachments?: {
    mimeType: string;
    data: string;
  }[];
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
  attachments?: {
    mimeType: string;
    data: string;
  }[];
  model?: string | null;
  cwd?: string;
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
      if (!isConnectionError(error)) throw error;

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
    attachments: { mimeType: string; data: string }[] = [],
    model?: string | null,
  ) => {
    const headers = buildHeaders(directory);
    const selectedModel = toOpencodeModelInput(model);
    const messageUrl = buildRequestUrl(baseUrl, `/session/${sessionId}/message`, directory);

    const messageResponse = await requestJson<Record<string, unknown>>(deps.fetcher, messageUrl, {
      method: "POST",
      headers,
      body: {
        parts: [
          { type: "text", text: prompt },
          ...attachments.map((attachment) => ({
            type: "file",
            mime: attachment.mimeType,
            url: `data:${attachment.mimeType};base64,${attachment.data}`,
          })),
        ],
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

      const messageComplete = postSessionMessage(baseUrl, sessionId, directory, prompt, input.attachments ?? []);

      return { sessionId, messageComplete };
    };

    return withServerUrl(createAndPrompt);
  };

  const sendSessionMessage = (input: OpencodeSessionMessageInput) => {
    const directory = input.cwd?.trim() || process.cwd();
    const prompt = input.prompt.trim();

    const messageComplete = withServerUrl((baseUrl) =>
      postSessionMessage(baseUrl, input.sessionId, directory, prompt, input.attachments ?? [], input.model),
    );

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
