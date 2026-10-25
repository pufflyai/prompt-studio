import { expect, test } from "bun:test";
import { normalizeChatMessagesForDisplay, type SessionMessage } from "./message-types";

for (const status of ["pending", "completed"] as const) {
  test(`keeps a ${status} question visible at a completed conversation tail and before a later user message`, () => {
    const messages: SessionMessage[] = [
      { id: "user", role: "user", parts: [{ type: "text", text: "Ask me" }] },
      {
        id: "question",
        role: "assistant",
        parts: [
          {
            type: "tool",
            tool: "question",
            callId: "async-1",
            status,
            state: {
              input: { delivery: "async", questions: [{ question: "Which color?", options: ["Blue"] }] },
              ...(status === "completed" ? { output: { answers: [["Blue"]] } } : {}),
            },
          },
        ],
      },
    ];
    expect(normalizeChatMessagesForDisplay(messages, { streaming: false }).map((message) => message.id)).toEqual([
      "user",
      "question",
    ]);
    messages.push({ id: "next-user", role: "user", parts: [{ type: "text", text: "Continue" }] });
    expect(normalizeChatMessagesForDisplay(messages).map((message) => message.id)).toEqual([
      "user",
      "question",
      "next-user",
    ]);
  });
}
