import { expect, test } from "bun:test";
import { observedSessionChange } from "./changes";

test("completion metadata cannot acknowledge a still-streaming fragment with the final message ID", async () => {
  const session = {
    createdAt: "created",
    status: "completed",
    changePositions: {
      reply: {
        id: "same",
        position: 8,
        textDigest: "a7d57fcddf4188887b3e1f38d435a2b80bff527a73269a4359c53a6dcedf52f7",
      },
    },
  };
  const transcript = (text: string) => [
    { id: "same", role: "assistant" as const, parts: [{ type: "text" as const, text }] },
  ];
  expect(await observedSessionChange(session, transcript("answer"))).toBeNull();
  expect(await observedSessionChange(session, transcript("answer is 41"))).toBeNull();
  expect(await observedSessionChange(session, transcript("answer is 42"))).toEqual({
    lineage: "conversation-v1/created",
    revision: "8",
  });
});
