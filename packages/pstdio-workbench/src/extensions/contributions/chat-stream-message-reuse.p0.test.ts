import { expect, test } from "bun:test";
import { createChatSubmissionPresentation } from "./chat-pending-submission";

const message = (id: string, text: string) => ({
  id,
  role: "assistant" as const,
  parts: [{ type: "text" as const, text }],
});

test("streaming one response preserves the displayed objects of completed messages", () => {
  const present = createChatSubmissionPresentation();
  const completed = message("completed", "Finished response");
  const active = message("active", "Starting");
  const first = present([completed, active]);
  const next = present([completed, message("active", "Starting to answer")]);

  expect(next.messages[0]).toBe(first.messages[0]);
  expect(next.historyMessages[0]).toBe(first.historyMessages[0]);
  expect(next.messages[1]).not.toBe(first.messages[1]);
  expect(next.messages[1].parts[0]).toEqual({ type: "text", text: "Starting to answer" });
});

test("unchanged upstream messages retain receipt identities without recreating their displayed row", () => {
  const present = createChatSubmissionPresentation();
  const prompt = { ...message("confirmed", "Question"), role: "user" as const, animationKey: "pending" };
  const completed = message("completed", "Finished response");
  const first = present([prompt, completed]);
  const second = present([prompt, completed, message("active", "New response")]);
  const third = present([prompt, completed, message("active", "New response continues")]);

  expect(second.messages[0]).toBe(first.messages[0]);
  expect(third.messages[0]).toBe(second.messages[0]);
  expect(third.messages[0].animationKey).toBe("pending");
  expect(third.messages[1]).toBe(second.messages[1]);
});
