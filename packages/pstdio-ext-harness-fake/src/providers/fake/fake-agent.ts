import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import type {
  ExtensionSetupContext,
  HarnessEventStore,
  HarnessProviderDefinition,
  HarnessResumeResult,
  HarnessSessionMessageInput,
  HarnessSessionMessagesInput,
  HarnessSessionStartInput,
  HarnessSessionStartResult,
  HarnessSpawnedProcess,
} from "@pstdio/sdk/extensions";
import type { SessionMessage } from "pstdio-agents";

const EXIT_DELAY_MS = 50;
const QUESTION_PROMPT_TRIGGER = "__fake_question_prompt__";

const createQuestionToolPart = () => ({
  type: "tool" as const,
  tool: "question",
  actionType: "execute" as const,
  status: "completed" as const,
  state: {
    status: "completed",
    input: {
      tool: "question",
      questions: [
        {
          id: "language",
          type: "single_choice",
          question: "Which language do you want to use?",
          options: ["TypeScript", "Python", "Go"],
          required: true,
        },
      ],
    },
  },
});

type FakeSession = {
  id: string;
  title: string;
  directory: string;
  updatedAt: string;
  messages: SessionMessage[];
};

const createMessage = (
  sessionId: string,
  index: number,
  role: SessionMessage["role"],
  text: string,
): SessionMessage => ({
  id: `${sessionId}-msg-${index}`,
  role,
  parts: [{ type: "text", text }],
  index,
});

const createQuestionMessage = (sessionId: string, index: number): SessionMessage => ({
  id: `${sessionId}-msg-${index}`,
  role: "assistant",
  parts: [createQuestionToolPart()],
  index,
});

const buildStartMessages = (sessionId: string, input: HarnessSessionStartInput) => {
  const userMessage = createMessage(sessionId, 0, "user", input.prompt);
  if (input.prompt.includes(QUESTION_PROMPT_TRIGGER)) {
    return [userMessage, createQuestionMessage(sessionId, 1)];
  }

  return [userMessage, createMessage(sessionId, 1, "assistant", `Fake Agent: completed "${input.prompt}"`)];
};

const buildResumeMessages = (sessionId: string, input: HarnessSessionMessageInput, startIndex: number) => [
  createMessage(sessionId, startIndex, "user", input.prompt),
  createMessage(sessionId, startIndex + 1, "assistant", `Fake Agent: follow-up "${input.prompt}"`),
];

const pushMessages = (eventStore: HarnessEventStore | undefined, startIndex: number, messages: SessionMessage[]) => {
  if (!eventStore) return;

  for (const [offset, message] of messages.entries()) {
    eventStore.push({
      op: "add",
      path: `/messages/${startIndex + offset}`,
      value: message,
    });
  }
};

const createProcess = (sessionId: string): HarnessSpawnedProcess => {
  let timeout: NodeJS.Timeout | null = null;
  const stdin = new PassThrough();
  let done = false;
  let resolveExit!: (value: { code: number | null; signal: string | null }) => void;

  const onExit = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    resolveExit = resolve;
    timeout = setTimeout(() => {
      done = true;
      resolve({ code: 0, signal: null });
    }, EXIT_DELAY_MS);
  });

  return {
    sessionId,
    stdin,
    kill: () => {
      if (done) return;
      done = true;
      if (timeout) clearTimeout(timeout);
      stdin.end();
      resolveExit({ code: null, signal: "SIGTERM" });
    },
    onExit,
  };
};

type FakeHarnessProvider = HarnessProviderDefinition & {
  getMessages(sessionId: string, input?: HarnessSessionMessagesInput): Promise<SessionMessage[]>;
  startSession(input: HarnessSessionStartInput): Promise<HarnessSessionStartResult>;
  resumeSession(input: HarnessSessionMessageInput, eventStore: HarnessEventStore): Promise<HarnessResumeResult>;
};

export const createFakeHarnessProvider = (): FakeHarnessProvider => {
  const sessions = new Map<string, FakeSession>();

  const upsertSession = (session: FakeSession) => {
    sessions.set(session.id, session);
  };

  function startSession(input: HarnessSessionStartInput): Promise<HarnessSessionStartResult>;
  function startSession(
    _ctx: ExtensionSetupContext,
    input: HarnessSessionStartInput,
  ): Promise<HarnessSessionStartResult>;
  async function startSession(
    ctxOrInput: ExtensionSetupContext | HarnessSessionStartInput,
    maybeInput?: HarnessSessionStartInput,
  ) {
    const input = maybeInput ?? (ctxOrInput as HarnessSessionStartInput);
    const sessionId = `fake-${randomUUID()}`;
    const messages = buildStartMessages(sessionId, input);

    upsertSession({
      id: sessionId,
      title: input.title ?? "Fake Session",
      directory: input.cwd ?? process.cwd(),
      updatedAt: new Date().toISOString(),
      messages,
    });

    pushMessages(input.eventStore, 0, messages);

    return {
      sessionId,
      process: createProcess(sessionId),
    };
  }

  function resumeSession(
    input: HarnessSessionMessageInput,
    eventStore: HarnessEventStore,
  ): Promise<HarnessResumeResult>;
  function resumeSession(
    _ctx: ExtensionSetupContext,
    input: HarnessSessionMessageInput,
    eventStore: HarnessEventStore,
  ): Promise<HarnessResumeResult>;
  async function resumeSession(
    ctxOrInput: ExtensionSetupContext | HarnessSessionMessageInput,
    inputOrEventStore: HarnessSessionMessageInput | HarnessEventStore,
    maybeEventStore?: HarnessEventStore,
  ) {
    const input = "sessionId" in ctxOrInput ? ctxOrInput : (inputOrEventStore as HarnessSessionMessageInput);
    const eventStore = "sessionId" in ctxOrInput ? (inputOrEventStore as HarnessEventStore) : maybeEventStore!;
    const existing = sessions.get(input.sessionId);
    const startIndex = input.messageOffset ?? existing?.messages.length ?? 0;
    const newMessages = buildResumeMessages(input.sessionId, input, startIndex);
    const nextMessages = [...(existing?.messages ?? [])];

    for (const [offset, message] of newMessages.entries()) {
      nextMessages[startIndex + offset] = message;
    }

    upsertSession({
      id: input.sessionId,
      title: existing?.title ?? "Fake Session",
      directory: input.cwd ?? existing?.directory ?? process.cwd(),
      updatedAt: new Date().toISOString(),
      messages: nextMessages,
    });

    pushMessages(eventStore, startIndex, newMessages);

    return {
      process: createProcess(input.sessionId),
    };
  }

  function getMessages(sessionId: string, input?: HarnessSessionMessagesInput): Promise<SessionMessage[]>;
  function getMessages(
    _ctx: ExtensionSetupContext,
    sessionId: string,
    input?: HarnessSessionMessagesInput,
  ): Promise<SessionMessage[]>;
  async function getMessages(
    ctxOrSessionId: ExtensionSetupContext | string,
    sessionIdOrInput?: string | HarnessSessionMessagesInput,
  ) {
    const sessionId = typeof ctxOrSessionId === "string" ? ctxOrSessionId : (sessionIdOrInput as string);
    return sessions.get(sessionId)?.messages ?? [];
  }

  return {
    id: "pstdio.harness.fake",
    label: "Fake Agent",
    async detect() {
      return { available: true };
    },
    listModels: () => [{ id: "fake" }],
    async start(_ctx, input) {
      const result = await startSession({
        prompt: input.prompt ?? "",
        cwd: input.workspacePath,
        env: { PSTDIO_SESSION_ID: input.sessionId },
      });

      return {
        runId: result.sessionId,
        onExit: result.process?.onExit,
      };
    },
    startSession,
    resumeSession,
    getMessages,
  };
};
