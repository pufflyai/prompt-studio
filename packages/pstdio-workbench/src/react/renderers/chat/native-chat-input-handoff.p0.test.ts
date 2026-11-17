import { expect, test } from "bun:test";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { handoffNativeChatInput } from "./native-chat-action";

const action = { type: "submit" as const, text: "Retained failed work", attachments: [], values: {} };
test("the shared owner keeps a rejected queued input while the generic editor completes its handoff", async () => {
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: async () => {
      throw new Error("Could not send");
    },
  });
  await expect(handoffNativeChatInput(session, () => session.run(action))).resolves.toBeUndefined();
  expect(session.getSnapshot().draft.text).toBe("");
  expect(session.getSnapshot().pending?.[0]?.failure).toBe("Could not send");
});
test("unowned ordinary and question failures still reject the generic editor handoff", async () => {
  const session = createChatSession({
    query: async () => ({}),
    action: async () => {
      throw new Error("Could not send");
    },
  });
  await expect(handoffNativeChatInput(session, () => session.run(action))).rejects.toThrow("Could not send");
  expect(session.getSnapshot().draft.text).toBe(action.text);
  session.accept({ revision: 1, snapshot: { streaming: true } });
  const question = { ...action, questionResponse: { callId: "q", answers: [["Yes"]] } };
  await expect(handoffNativeChatInput(session, () => session.run(question))).rejects.toThrow("Could not send");
  expect(session.getSnapshot().pending?.some((item) => item.failure)).toBeFalsy();
  expect(session.getSnapshot().draft.text).toBe(action.text);
});
