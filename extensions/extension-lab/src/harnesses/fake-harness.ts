import { randomUUID } from "node:crypto";
import type {
  HarnessAttachment,
  HarnessEventSink,
  HarnessProvider,
  HarnessResumeInput,
  HarnessSession,
  HarnessStartInput,
  SessionMessage,
  SessionMessagePart,
} from "@pstdio/sdk/extensions";
import { l10n } from "@pstdio/sdk/extensions";

const EXIT_DELAY_MS = 50;
const QUESTION_PROMPT_TRIGGER = "__fake_question_prompt__";

const createQuestionToolPart = () => {
  const part = {
    type: "tool",
    tool: "question",
    actionType: "execute",
    status: "completed",
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
  } satisfies SessionMessagePart;

  return part;
};

const attachmentParts = (attachments: HarnessAttachment[] = []) =>
  attachments.map((attachment) => ({
    type: "file" as const,
    fileId: attachment.fileId,
    filename: attachment.fileName,
    mediaType: attachment.mimeType ?? undefined,
    size: attachment.sizeBytes,
    url: attachment.url,
  }));

const createMessage = (input: {
  agentSessionId: string;
  index: number;
  role: SessionMessage["role"];
  text: string;
  attachments?: HarnessAttachment[];
}) => {
  const message = {
    id: `${input.agentSessionId}-msg-${input.index}`,
    role: input.role,
    parts: [{ type: "text" as const, text: input.text }, ...attachmentParts(input.attachments)],
    index: input.index,
  } satisfies SessionMessage;

  return message;
};

const createQuestionMessage = (agentSessionId: string, index: number) => {
  const message = {
    id: `${agentSessionId}-msg-${index}`,
    role: "assistant",
    parts: [createQuestionToolPart()],
    index,
  } satisfies SessionMessage;

  return message;
};

const buildStartMessages = (agentSessionId: string, input: HarnessStartInput) => {
  const userMessage = createMessage({
    agentSessionId,
    index: 0,
    role: "user",
    text: input.prompt,
    attachments: input.attachments,
  });
  if (input.prompt.includes(QUESTION_PROMPT_TRIGGER)) {
    return [userMessage, createQuestionMessage(agentSessionId, 1)];
  }

  return [
    userMessage,
    createMessage({
      agentSessionId,
      index: 1,
      role: "assistant",
      text: `Fake Agent: completed "${input.prompt}"`,
    }),
  ];
};

const buildResumeMessages = (input: HarnessResumeInput, startIndex: number) => [
  createMessage({
    agentSessionId: input.agentSessionId,
    index: startIndex,
    role: "user",
    text: input.prompt,
    attachments: input.attachments,
  }),
  createMessage({
    agentSessionId: input.agentSessionId,
    index: startIndex + 1,
    role: "assistant",
    text: `Fake Agent: follow-up "${input.prompt}"`,
  }),
];

const pushMessages = (events: HarnessEventSink, startIndex: number, messages: SessionMessage[]) => {
  for (const [offset, message] of messages.entries()) {
    events.push({
      op: "add",
      path: `/messages/${startIndex + offset}`,
      value: message,
    });
  }
};

const createSession = (agentSessionId: string) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let settled = false;
  let resolveDone!: (value: { status: "completed" | "cancelled" }) => void;

  const done = new Promise<{ status: "completed" | "cancelled" }>((resolve) => {
    resolveDone = resolve;
    timeout = setTimeout(() => {
      settled = true;
      resolve({ status: "completed" });
    }, EXIT_DELAY_MS);
  });

  const session = {
    agentSessionId,
    done,
    stop: () => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolveDone({ status: "cancelled" });
    },
    timeoutStrategy: "activity",
  } satisfies HarnessSession;

  return session;
};

export const createFakeHarness = () => {
  const sessions = new Map<string, SessionMessage[]>();

  const provider = {
    id: "fake",
    label: l10n("harness.fake", "Fake Agent"),

    capabilities: () => [],
    listModels: () => [{ id: "fake" }],

    start: (_ctx, input) => {
      const agentSessionId = `fake-${randomUUID()}`;
      const messages = buildStartMessages(agentSessionId, input);

      sessions.set(agentSessionId, messages);
      pushMessages(input.events, 0, messages);

      return createSession(agentSessionId);
    },

    resume: (_ctx, input) => {
      const existing = sessions.get(input.agentSessionId);
      const startIndex = input.messageOffset ?? existing?.length ?? 0;
      const newMessages = buildResumeMessages(input, startIndex);
      const nextMessages = [...(existing ?? [])];

      for (const [offset, message] of newMessages.entries()) {
        nextMessages[startIndex + offset] = message;
      }

      sessions.set(input.agentSessionId, nextMessages);
      pushMessages(input.events, startIndex, newMessages);

      return createSession(input.agentSessionId);
    },

    getMessages: (_ctx, input) => sessions.get(input.agentSessionId) ?? [],
  } satisfies Omit<HarnessProvider, "ref">;

  return provider;
};
