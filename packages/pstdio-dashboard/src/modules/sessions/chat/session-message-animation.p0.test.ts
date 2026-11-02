import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { createPendingFollowUpState, mergeMessagesWithPendingFollowUp } from "./session-chat-state";

const userMessage = (id: string): SessionMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text: "Check the release risks." }],
});

test("confirmation retains the sent message's animation identity after pending state clears", () => {
  const identities = new Map<string, string>();
  const pending = createPendingFollowUpState({
    prompt: "Check the release risks.",
    messageCount: 1,
    pendingId: "pending",
  });
  const history = [userMessage("previous")];
  const optimistic = mergeMessagesWithPendingFollowUp(history, pending, identities);
  expect(optimistic[1].id).toBe("pending-user");

  const accepted = [...history, userMessage("native")];
  expect(mergeMessagesWithPendingFollowUp(accepted, pending, identities)[1]).toMatchObject({
    id: "native",
    animationKey: "pending-user",
  });
  expect(mergeMessagesWithPendingFollowUp(accepted, null, identities)[1].animationKey).toBe("pending-user");

  const next = createPendingFollowUpState({ prompt: pending.prompt, messageCount: 2, pendingId: "next" });
  expect(
    mergeMessagesWithPendingFollowUp([...accepted, userMessage("next-native")], next, identities)[2],
  ).toMatchObject({
    id: "next-native",
    animationKey: "next-user",
  });
});
