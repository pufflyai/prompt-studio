import { readFile } from "node:fs/promises";
import type { HarnessAttachment } from "@pstdio/sdk/extensions";
import {
  buildHeaders,
  buildRequestUrl,
  type OpencodeFetcher,
  parsePromptResponse,
  requestJson,
  requireResponseOk,
} from "./opencode-http";
import { createQuestionApi } from "./opencode-questions";
import {
  canConnectToHost,
  createFileServerStore,
  createServerConnection,
  defaultPingServer,
  defaultServerStorePath,
  defaultStartServer,
  type OpencodeServerStarter,
  type OpencodeServerStore,
} from "./opencode-server";
import type { OpencodeSessionMessage } from "./opencode-types";

type OpencodeServiceDeps = {
  startServer: OpencodeServerStarter;
  serverStore: OpencodeServerStore;
  pingServer: (url: string) => Promise<boolean>;
  isPortOpen: (options: { host: string; port: number }) => Promise<boolean>;
  fetcher: OpencodeFetcher;
};

type OpencodeSessionStartInput = {
  prompt: string;
  attachments?: HarnessAttachment[];
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
  attachments?: HarnessAttachment[];
  model?: string | null;
  cwd?: string;
};

type OpencodeModelInput = {
  providerID: string;
  modelID: string;
};

type OpencodeSessionModelInput = {
  providerID: string;
  id: string;
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

const toOpencodeSessionModelInput = (model?: string | null) => {
  const selectedModel = toOpencodeModelInput(model);
  if (!selectedModel) return undefined;

  return { providerID: selectedModel.providerID, id: selectedModel.modelID } satisfies OpencodeSessionModelInput;
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
  return {
    type: "file",
    fileId: attachment.fileId,
    mime,
    filename: attachment.fileName,
    url: `data:${mime};base64,${bytes.toString("base64")}`,
  };
};

const buildMessageParts = async (prompt: string, attachments: HarnessAttachment[]) => {
  const fileParts = await Promise.all(attachments.map(toFilePart));
  return [{ type: "text", text: prompt }, ...fileParts];
};

export const createOpencodeService = (overrides: Partial<OpencodeServiceDeps> = {}) => {
  const deps: OpencodeServiceDeps = {
    startServer: overrides.startServer ?? defaultStartServer,
    serverStore: overrides.serverStore ?? createFileServerStore(defaultServerStorePath()),
    pingServer: overrides.pingServer ?? defaultPingServer,
    isPortOpen: overrides.isPortOpen ?? canConnectToHost,
    fetcher: overrides.fetcher ?? fetch,
  };

  const { withServerUrl } = createServerConnection(deps);

  const postSessionMessage = async (
    baseUrl: string,
    sessionId: string,
    directory: string,
    prompt: string,
    attachments?: HarnessAttachment[],
    model?: string | null,
  ) => {
    const headers = buildHeaders(directory);
    const selectedModel = toOpencodeModelInput(model);
    const messageUrl = buildRequestUrl(baseUrl, `/session/${sessionId}/message`, directory);

    const messageResponse = await requestJson<Record<string, unknown>>(deps.fetcher, messageUrl, {
      method: "POST",
      headers,
      body: {
        // Keep the no-attachment path synchronous so it does not reorder against the poll loop.
        parts:
          attachments && attachments.length > 0
            ? await buildMessageParts(prompt, attachments)
            : [{ type: "text", text: prompt }],
        ...(selectedModel ? { model: selectedModel } : {}),
      },
    });

    requireResponseOk(messageResponse.response, messageResponse.text, "OpenCode session.prompt failed");
    parsePromptResponse(messageResponse.text);
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
      const createUrl = buildRequestUrl(baseUrl, "/session", directory);

      const createResponse = await requestJson<{ id?: string }>(deps.fetcher, createUrl, {
        method: "POST",
        headers,
        body: { model: toOpencodeSessionModelInput(input.model) },
      });

      requireResponseOk(createResponse.response, createResponse.text, "OpenCode session.create failed");

      const sessionId = createResponse.parsed?.id;
      if (!sessionId) throw new Error("Opencode session id not found.");

      const messageComplete = postSessionMessage(baseUrl, sessionId, directory, prompt, input.attachments, input.model);

      return { sessionId, messageComplete };
    };

    return withServerUrl(createAndPrompt);
  };

  const sendSessionMessage = (input: OpencodeSessionMessageInput) => {
    const directory = input.cwd?.trim() || process.cwd();
    const prompt = input.prompt.trim();

    const messageComplete = withServerUrl((baseUrl) =>
      postSessionMessage(baseUrl, input.sessionId, directory, prompt, input.attachments, input.model),
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

  const abortSession = async (sessionId: string, cwd?: string) => {
    const directory = cwd?.trim() || process.cwd();

    const abortRunningSession = async (baseUrl: string) => {
      const headers = buildHeaders(directory);
      const url = buildRequestUrl(baseUrl, `/session/${sessionId}/abort`, directory);

      const { response, text } = await requestJson<boolean>(deps.fetcher, url, {
        method: "POST",
        headers,
      });

      requireResponseOk(response, text, "OpenCode session.abort failed");
    };

    return withServerUrl(abortRunningSession);
  };

  const { listPendingQuestions, replyQuestion } = createQuestionApi({ fetcher: deps.fetcher, withServerUrl });

  return { startSession, sendSessionMessage, getSessionMessages, abortSession, listPendingQuestions, replyQuestion };
};
