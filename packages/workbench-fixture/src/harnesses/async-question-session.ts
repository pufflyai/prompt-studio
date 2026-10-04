import type { HarnessExit, HarnessSession, HarnessStartInput, SessionMessage } from "@pstdio/sdk/extensions";

export const createAsyncQuestionSession = (
  agentSessionId: string,
  input: HarnessStartInput,
  messages: SessionMessage[],
) => {
  const completion = Promise.withResolvers<HarnessExit>();
  const offset = messages.length;
  const first: SessionMessage = {
    id: `${agentSessionId}-async-first`,
    role: "assistant",
    parts: [
      {
        type: "tool",
        tool: "question",
        callId: "first-question",
        status: "pending",
        state: {
          input: { questions: [{ question: "Which language?", options: ["TypeScript", "Python"], custom: true }] },
        },
      },
    ],
  };
  const second: SessionMessage = {
    id: `${agentSessionId}-async-second`,
    role: "assistant",
    parts: [
      {
        type: "tool",
        tool: "question",
        callId: "second-question",
        status: "pending",
        state: { input: { questions: [{ question: "Which validation?", options: ["Browser", "Native"] }] } },
      },
    ],
  };
  const publish = (message: SessionMessage, index: number) => {
    messages[index] = message;
    input.events.push({ op: "add", path: `/messages/${index}`, value: message });
  };
  publish(first, offset);
  const timer = setTimeout(() => publish(second, offset + 1), 500);
  const answered = new Set<string>();
  const session: HarnessSession = {
    agentSessionId,
    done: completion.promise,
    timeoutStrategy: "activity",
    stop: () => {
      clearTimeout(timer);
      completion.resolve({ status: "cancelled" });
    },
    replyQuestion: async (response) => {
      clearTimeout(timer);
      if (messages.length < offset + 2) publish(second, offset + 1);
      const index = messages.findIndex((message) =>
        message.parts.some((part) => part.type === "tool" && part.callId === response.callId),
      );
      if (index < 0 || !response.callId || answered.has(response.callId))
        throw new Error("Question is no longer pending.");
      const message = messages[index];
      const updated = {
        ...message,
        parts: message.parts.map((part) =>
          part.type === "tool"
            ? {
                ...part,
                status: "completed" as const,
                state: { ...part.state, metadata: { answers: response.answers } },
              }
            : part,
        ),
      };
      messages[index] = updated;
      input.events.push({ op: "replace", path: `/messages/${index}`, value: updated });
      answered.add(response.callId);
      if (answered.size === 2) completion.resolve({ status: "completed" });
    },
  };
  return session;
};
