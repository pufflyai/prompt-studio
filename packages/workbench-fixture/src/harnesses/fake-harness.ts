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
import { l10n, reconcileMessageHistory } from "@pstdio/sdk/extensions";
import {
  DEFAULT_LONG_STREAM,
  LONG_STREAM_PROMPT_TRIGGER,
  type LongStreamShape,
  replayLongStream,
} from "./long-stream-replay";

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

const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

// The session runs until its work finishes, or until it is stopped.
const createSession = (
  agentSessionId: string,
  run: (signal: AbortSignal) => Promise<unknown> = () => delay(EXIT_DELAY_MS),
) => {
  const controller = new AbortController();
  let resolveDone!: (value: { status: "completed" | "cancelled" }) => void;
  const done = new Promise<{ status: "completed" | "cancelled" }>((resolve) => {
    resolveDone = resolve;
  });
  void run(controller.signal).then(() => {
    if (!controller.signal.aborted) resolveDone({ status: "completed" });
  });

  const session = {
    agentSessionId,
    done,
    stop: () => {
      if (controller.signal.aborted) return;
      controller.abort();
      resolveDone({ status: "cancelled" });
    },
    timeoutStrategy: "activity",
  } satisfies HarnessSession;

  return session;
};

export const createFakeHarness = (longStream: LongStreamShape = DEFAULT_LONG_STREAM) => {
  const sessions = new Map<string, SessionMessage[]>();

  const provider = {
    id: "fake",
    label: l10n("harness.fake", "Fake Agent"),

    capabilities: () => [],
    listModels: () => [{ id: "fake" }],

    start: (_ctx, input) => {
      const agentSessionId = `fake-${randomUUID()}`;
      if (input.prompt.includes(LONG_STREAM_PROMPT_TRIGGER)) {
        const messages: SessionMessage[] = buildStartMessages(agentSessionId, input).slice(0, 1);
        sessions.set(agentSessionId, messages);
        pushMessages(input.events, 0, messages);
        return createSession(agentSessionId, (signal) =>
          replayLongStream({
            agentSessionId,
            startIndex: 1,
            shape: longStream,
            signal,
            push: (patch) => {
              messages[Number(patch.path.slice("/messages/".length))] = patch.value as SessionMessage;
              input.events.push(patch);
            },
          }),
        );
      }
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
    recoverMessages: (_ctx, input) => reconcileMessageHistory(input),
  } satisfies Omit<HarnessProvider, "ref">;

  return provider;
};
