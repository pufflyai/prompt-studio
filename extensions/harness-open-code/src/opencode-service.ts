import { readFile } from "node:fs/promises";
import type { SessionMessageInfo, SessionMessagesResponse } from "@opencode/client";
import type { HarnessAttachment, HarnessParams } from "@pstdio/sdk/extensions";
import { createOpencodeAuthentication } from "./authentication";
import { createCommandApi } from "./opencode-commands";
import { buildHeaders, buildRequestUrl, type OpencodeFetcher, requestJson, requireResponseOk } from "./opencode-http";
import { createQuestionApi } from "./opencode-questions";
import {
  canConnectToHost,
  createServerConnection,
  defaultPingServer,
  defaultStartServer,
  type OpencodeServerStarter,
  type OpencodeServerStore,
} from "./opencode-server";
import { toSessionSnapshot } from "./opencode-snapshot";

type OpencodeServiceDeps = {
  reuseExisting?: boolean;
  startServer: OpencodeServerStarter;
  serverStore: OpencodeServerStore;
  pingServer: (url: string) => Promise<boolean>;
  isPortOpen: (options: { host: string; port: number }) => Promise<boolean>;
  fetcher: OpencodeFetcher;
};

type OpencodeSessionStartInput = {
  signal?: AbortSignal;
  prompt: string;
  attachments?: HarnessAttachment[];
  model?: string | null;
  params?: HarnessParams;
  cwd?: string;
};

type OpencodeSessionStartResult = {
  sessionId: string;
  messageComplete: Promise<void>;
};

type OpencodeSessionMessageInput = {
  signal?: AbortSignal;
  sessionId: string;
  prompt: string;
  attachments?: HarnessAttachment[];
  model?: string | null;
  params?: HarnessParams;
  cwd?: string;
};

const toModel = (model?: string | null, params?: HarnessParams) => {
  if (!model) return undefined;
  const slash = model.indexOf("/");
  if (slash <= 0 || slash === model.length - 1) return undefined;
  return {
    providerID: model.slice(0, slash),
    id: model.slice(slash + 1),
    ...(typeof params?.variant === "string" ? { variant: params.variant } : {}),
  };
};

const resolveMockSessionId = () => {
  const fixed = process.env.OPENCODE_MOCK_SESSION_ID?.trim();
  if (fixed) return fixed;

  const prefix = process.env.OPENCODE_MOCK_SESSION_ID_PREFIX?.trim();
  if (prefix) return `${prefix}${crypto.randomUUID()}`;

  return null;
};

// OpenCode ingests attachments as file parts (true vision for images) rather than
// a text manifest the model would have to read with a tool — that read step hung.
const toFilePart = async (attachment: HarnessAttachment) => {
  const mime = attachment.mimeType || "application/octet-stream";
  const bytes = await readFile(attachment.localPath);
  return { name: attachment.fileName, uri: `data:${mime};base64,${bytes.toString("base64")}` };
};

export const createOpencodeService = (overrides: Partial<OpencodeServiceDeps> = {}) => {
  const deps: OpencodeServiceDeps = {
    reuseExisting: overrides.reuseExisting,
    startServer: overrides.startServer ?? defaultStartServer,
    serverStore: overrides.serverStore ?? { read: async () => null, write: async () => {}, clear: async () => {} },
    pingServer: overrides.pingServer ?? defaultPingServer,
    isPortOpen: overrides.isPortOpen ?? canConnectToHost,
    fetcher: overrides.fetcher ?? fetch,
  };

  const { withServerUrl, dispose, cancelPendingStartup } = createServerConnection(deps);

  const postSessionMessage = async (
    baseUrl: string,
    sessionId: string,
    directory: string,
    prompt: string,
    attachments?: HarnessAttachment[],
    model?: string | null,
    params?: HarnessParams,
    signal?: AbortSignal,
  ) => {
    const headers = buildHeaders(directory);
    const selectedModel = toModel(model, params);
    if (selectedModel) {
      const selection = await requestJson(
        deps.fetcher,
        buildRequestUrl(baseUrl, `/api/session/${sessionId}/model`, directory),
        {
          method: "POST",
          headers,
          signal,
          body: { model: selectedModel },
        },
      );
      requireResponseOk(selection.response, selection.text, "OpenCode model selection failed");
    }
    const messageUrl = buildRequestUrl(baseUrl, `/api/session/${sessionId}/prompt`, directory);
    const messageResponse = await requestJson<{ data?: { id?: string } }>(deps.fetcher, messageUrl, {
      method: "POST",
      headers,
      signal,
      body: {
        text: prompt,
        ...(attachments?.length
          ? {
              files: await Promise.all(attachments.map(toFilePart)),
              metadata: { pstdioAttachments: attachments.map((attachment) => attachment.fileId) },
            }
          : {}),
      },
    });
    requireResponseOk(messageResponse.response, messageResponse.text, "OpenCode session.prompt failed");
    if (!messageResponse.parsed?.data?.id) throw new Error("OpenCode did not accept the prompt.");
    // Admission is asynchronous. Keep messageComplete pending until native execution becomes idle.
    const waiting = await requestJson(
      deps.fetcher,
      buildRequestUrl(baseUrl, `/api/experimental/session/${sessionId}/wait`, directory),
      {
        method: "POST",
        headers,
        signal,
      },
    );
    requireResponseOk(waiting.response, waiting.text, "OpenCode session wait failed");
  };

  const startSession = async (input: OpencodeSessionStartInput): Promise<OpencodeSessionStartResult> => {
    const mockSessionId = resolveMockSessionId();

    if (mockSessionId) {
      return { sessionId: mockSessionId, messageComplete: Promise.resolve() };
    }

    const prompt = input.prompt.trim() || "New session";
    const directory = input.cwd?.trim() || process.cwd();

    const createAndPrompt = async (baseUrl: string) => {
      const headers = buildHeaders(directory);
      const createUrl = buildRequestUrl(baseUrl, "/api/session", directory);

      const createResponse = await requestJson<{ data?: { id?: string } }>(deps.fetcher, createUrl, {
        method: "POST",
        headers,
        body: { location: { directory }, model: toModel(input.model, input.params) },
      });

      requireResponseOk(createResponse.response, createResponse.text, "OpenCode session.create failed");

      const sessionId = createResponse.parsed?.data?.id;
      if (!sessionId) throw new Error("Opencode session id not found.");
      if (input.signal?.aborted) {
        await abortSession(sessionId, directory);
        input.signal.throwIfAborted();
      }

      const messageComplete = postSessionMessage(
        baseUrl,
        sessionId,
        directory,
        prompt,
        input.attachments,
        input.model,
        input.params,
        input.signal,
      );

      return { sessionId, messageComplete };
    };

    return withServerUrl(createAndPrompt);
  };

  const sendSessionMessage = (input: OpencodeSessionMessageInput) => {
    const directory = input.cwd?.trim() || process.cwd();
    const prompt = input.prompt.trim();

    const messageComplete = withServerUrl((baseUrl) =>
      postSessionMessage(
        baseUrl,
        input.sessionId,
        directory,
        prompt,
        input.attachments,
        input.model,
        input.params,
        input.signal,
      ),
    );

    return { messageComplete };
  };

  const getSessionMessages = async (sessionId: string, cwd?: string) => {
    const directory = cwd?.trim() || process.cwd();

    const fetchMessages = async (baseUrl: string) => {
      const headers = buildHeaders(directory);
      const messages: SessionMessageInfo[] = [];
      let cursor: string | null | undefined;
      do {
        const url = new URL(buildRequestUrl(baseUrl, `/api/session/${sessionId}/message`, directory));
        if (cursor) url.searchParams.set("cursor", cursor);
        else url.searchParams.set("order", "asc");
        const { response, text, parsed } = await requestJson<SessionMessagesResponse>(deps.fetcher, url.href, {
          method: "GET",
          headers,
        });
        requireResponseOk(response, text, "OpenCode getSessionMessages failed");
        if (!parsed || !Array.isArray(parsed.data)) throw new Error("OpenCode returned invalid session messages.");
        messages.push(...parsed.data);
        cursor = parsed.cursor?.next;
      } while (cursor);
      return toSessionSnapshot(messages);
    };

    return withServerUrl(fetchMessages);
  };

  const abortSession = async (sessionId: string, cwd?: string) => {
    const directory = cwd?.trim() || process.cwd();

    const abortRunningSession = async (baseUrl: string) => {
      const headers = buildHeaders(directory);
      const url = buildRequestUrl(baseUrl, `/api/session/${sessionId}/interrupt`, directory);

      const { response, text } = await requestJson<boolean>(deps.fetcher, url, {
        method: "POST",
        headers,
      });

      requireResponseOk(response, text, "OpenCode session.abort failed");
    };

    return withServerUrl(abortRunningSession);
  };

  const { listPendingQuestions, replyQuestion } = createQuestionApi({ fetcher: deps.fetcher, withServerUrl });

  return {
    getAuthentication: createOpencodeAuthentication({ fetcher: deps.fetcher, withServerUrl }).getAuthentication,
    dispose,
    cancelPendingStartup,
    startSession,
    sendSessionMessage,
    getSessionMessages,
    abortSession,
    listPendingQuestions,
    replyQuestion,
    ...createCommandApi({ fetcher: deps.fetcher, withServerUrl }),
  };
};
