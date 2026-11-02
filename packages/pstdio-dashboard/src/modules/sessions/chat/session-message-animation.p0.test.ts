import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { applyDashboardSessionMessagePatch } from "../data/session-messages";
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

for (const snapshot of [false, true])
  test(`retains optimistic identity through a harness echo after pending clears (${snapshot ? "snapshot" : "indexed patch"})`, () => {
    const identities = new Map<string, string>();
    const pending = createPendingFollowUpState({
      prompt: "Check the release risks.",
      messageCount: 0,
      pendingId: "pending",
    });
    const harnessEcho = [{ ...userMessage("harness-pending"), createdAt: 123 }];
    mergeMessagesWithPendingFollowUp(harnessEcho, pending, identities);
    const confirmed = applyDashboardSessionMessagePatch(harnessEcho, {
      op: "replace",
      path: snapshot ? "/messages" : "/messages/0",
      value: snapshot ? [{ ...userMessage("native"), createdAt: 123 }] : { ...userMessage("native"), createdAt: 123 },
    });
    expect(mergeMessagesWithPendingFollowUp(confirmed, null, identities)[0]).toMatchObject({
      id: "native",
      animationKey: "pending-user",
    });
  });

for (const createdAt of [undefined, 124])
  test(`does not reuse identity for a repeated prompt with ${createdAt === undefined ? "missing" : "different"} timestamp`, () => {
    const previous = { ...userMessage("previous"), createdAt: 123, animationKey: "pending-user" };
    const confirmed = applyDashboardSessionMessagePatch([previous], {
      op: "replace",
      path: "/messages",
      value: [{ ...userMessage("native"), createdAt }],
    });
    expect(confirmed[0].animationKey).toBeUndefined();
  });
