import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import type {
  AgentService,
  EventStore,
  SessionMessage,
  SessionMessageInput,
  SessionStartInput,
  SpawnedProcess,
} from "../../types";

const EXIT_DELAY_MS = 50;
const HOLD_OPEN_MARKER = "[fake-agent:hold-open]";
const HOLD_OPEN_EXIT_DELAY_MS = 30_000;

const sanitizePrompt = (prompt: string) => prompt.replace(HOLD_OPEN_MARKER, "").trim();

const resolveExitDelayMs = (prompt: string) =>
  prompt.includes(HOLD_OPEN_MARKER) ? HOLD_OPEN_EXIT_DELAY_MS : EXIT_DELAY_MS;

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

const buildStartMessages = (sessionId: string, input: SessionStartInput) => [
  createMessage(sessionId, 0, "user", sanitizePrompt(input.prompt)),
  createMessage(sessionId, 1, "assistant", `Fake Agent: completed "${sanitizePrompt(input.prompt)}"`),
];

const buildResumeMessages = (sessionId: string, input: SessionMessageInput, startIndex: number) => [
  createMessage(sessionId, startIndex, "user", sanitizePrompt(input.prompt)),
  createMessage(sessionId, startIndex + 1, "assistant", `Fake Agent: follow-up "${sanitizePrompt(input.prompt)}"`),
];

const pushMessages = (eventStore: EventStore | undefined, startIndex: number, messages: SessionMessage[]) => {
  if (!eventStore) return;

  for (const [offset, message] of messages.entries()) {
    eventStore.push({
      op: "add",
      path: `/messages/${startIndex + offset}`,
      value: message,
    });
  }
};

const createProcess = (sessionId: string, exitDelayMs: number): SpawnedProcess => {
  let timeout: NodeJS.Timeout | null = null;
  const stdin = new PassThrough();
  let done = false;

  const onExit = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    timeout = setTimeout(() => {
      done = true;
      resolve({ code: 0, signal: null });
    }, exitDelayMs);
  });

  return {
    sessionId,
    stdin,
    kill: () => {
      if (done) return;
      done = true;
      if (timeout) clearTimeout(timeout);
      stdin.end();
    },
    onExit,
  };
};

export const createFakeAgent = (): AgentService => {
  const sessions = new Map<string, FakeSession>();

  const upsertSession = (session: FakeSession) => {
    sessions.set(session.id, session);
  };

  const startSession = async (input: SessionStartInput) => {
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
      process: createProcess(sessionId, resolveExitDelayMs(input.prompt)),
    };
  };

  const resumeSession = async (input: SessionMessageInput, eventStore: EventStore) => {
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
      process: createProcess(input.sessionId, resolveExitDelayMs(input.prompt)),
    };
  };

  const getMessages = async (sessionId: string) => sessions.get(sessionId)?.messages ?? [];

  const listSessions = async () =>
    [...sessions.values()].map((session) => ({
      id: session.id,
      title: session.title,
      directory: session.directory,
      updatedAt: session.updatedAt,
    }));

  const exportSession = async (sessionId: string) => {
    const session = sessions.get(sessionId);
    const fallbackTime = new Date().toISOString();
    return {
      session: {
        id: sessionId,
        title: session?.title ?? "Fake Session",
        directory: session?.directory ?? process.cwd(),
        updatedAt: session?.updatedAt ?? fallbackTime,
      },
      messages: session?.messages ?? [],
    };
  };

  const launchSession = async () => ({});

  return {
    id: "fake",
    name: "Fake Agent",
    capabilities: () => [],
    checkAvailability: () => ({ type: "INSTALLED" }),
    listModels: () => [{ id: "fake" }],
    startSession,
    resumeSession,
    getMessages,
    listSessions,
    exportSession,
    launchSession,
  };
};
