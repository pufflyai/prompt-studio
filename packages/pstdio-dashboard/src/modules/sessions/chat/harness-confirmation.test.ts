import { expect, test } from "bun:test";
import type { HarnessCommandState } from "pstdio-api-contracts";
import {
  createHarnessConfirmation,
  nextHarnessConfirmation,
  updateDismissedConfirmations,
} from "./harness-confirmation";

const mode: HarnessCommandState["modes"][number] = {
  id: "planning",
  label: "Plan",
  description: "The native plan",
  state: "Awaiting approval",
  confirmation: { id: "revision", title: "Approve plan", actionId: "implement", cancelLabel: "Keep planning" },
  actions: [{ id: "implement", label: "Approve and implement" }],
};
test("each mode stays dismissed until its revision changes or that mode is reopened", () => {
  const other = { ...mode, id: "goal" };
  const modes = [mode, other];
  const first = createHarnessConfirmation(mode, { scope: "session", onAction: async () => {}, onDismiss: () => {} })!;
  const second = createHarnessConfirmation(other, { scope: "session", onAction: async () => {}, onDismiss: () => {} })!;
  let dismissed = updateDismissedConfirmations(undefined, "session", mode.id, first.prompt.callId);
  expect(nextHarnessConfirmation(modes, "session", dismissed)).toBe(other);
  dismissed = updateDismissedConfirmations(dismissed, "session", other.id, second.prompt.callId);
  expect(nextHarnessConfirmation(modes, "session", dismissed)).toBeUndefined();
  const reopened = updateDismissedConfirmations(dismissed, "session", mode.id);
  expect(nextHarnessConfirmation(modes, "session", reopened)).toBe(mode);
  expect(nextHarnessConfirmation([other], "session", reopened)).toBeUndefined();
  const revised = { ...mode, confirmation: { ...mode.confirmation!, id: "new-revision" } };
  expect(nextHarnessConfirmation([revised, other], "session", dismissed)).toBe(revised);
  expect(nextHarnessConfirmation(modes, "another-session", dismissed)).toBe(mode);
});
test("composer approval dispatches the displayed revision and preserves the native snapshot", async () => {
  const actions: unknown[] = [];
  const dismissed: string[] = [];
  const decision = createHarnessConfirmation(mode, {
    scope: "session",
    onAction: async (...args) => {
      actions.push(args);
    },
    onDismiss: (id) => dismissed.push(id),
  });
  expect(decision).toBeDefined();
  await decision!.onRespond({ callId: decision!.prompt.callId, answers: [["Approve and implement"]] });
  expect(actions).toEqual([["planning", "implement", "revision", mode]]);
  expect(dismissed).toEqual([decision!.prompt.callId]);
});
test("keeping planning and skipping restore the composer without a native mutation", async () => {
  const actions: unknown[] = [];
  const dismissed: string[] = [];
  const decision = createHarnessConfirmation(mode, {
    scope: "session",
    onAction: async (...args) => {
      actions.push(args);
    },
    onDismiss: (id) => dismissed.push(id),
  });
  await decision!.onRespond({ callId: decision!.prompt.callId, answers: [["Keep planning"]] });
  await decision!.onRespond({ callId: decision!.prompt.callId, answers: [] });
  expect(actions).toEqual([]);
  expect(dismissed).toHaveLength(2);
});
test("an old decision cannot approve a changed plan and unavailable state permits only dismissal", async () => {
  const decision = createHarnessConfirmation(mode, {
    scope: "session",
    unavailable: true,
    onAction: async () => {
      throw Error("Must not dispatch");
    },
    onDismiss: () => {},
  });
  expect(decision!.canRespond!({ answers: [["Approve and implement"]] })).toBe(false);
  expect(decision!.canRespond!({ answers: [["Keep planning"]] })).toBe(true);
  await expect(decision!.onRespond({ callId: "old", answers: [["Approve and implement"]] })).rejects.toThrow("changed");
});
