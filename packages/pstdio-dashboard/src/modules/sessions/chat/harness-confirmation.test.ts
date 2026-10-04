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
  confirmation: {
    id: "revision",
    title: "Approve plan",
    actionId: "implement",
    cancelLabel: "Keep planning",
    model: "native-model",
  },
  actions: [{ id: "implement", label: "Approve and implement" }],
};
test("each mode stays dismissed until its revision changes or that mode is reopened", () => {
  const other = { ...mode, id: "goal" };
  const modes = [mode, other];
  const first = createHarnessConfirmation(mode, { scope: "session", onAction: async () => {}, onDismiss: () => {} })!;
  const second = createHarnessConfirmation(other, { scope: "session", onAction: async () => {}, onDismiss: () => {} })!;
  let dismissed = updateDismissedConfirmations(undefined, "session", mode.id, first.id);
  expect(nextHarnessConfirmation(modes, "session", dismissed)).toBe(other);
  dismissed = updateDismissedConfirmations(dismissed, "session", other.id, second.id);
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
  expect(decision!.model).toBe("native-model");
  await decision!.onAction("approve");
  expect(actions).toEqual([["planning", "implement", "revision", mode]]);
  expect(dismissed).toEqual([decision!.id]);
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
  await decision!.onAction("continue");
  await decision!.onAction("skip");
  expect(actions).toEqual([]);
  expect(dismissed).toHaveLength(2);
});
test("unavailable state permits dismissal but blocks native approval", async () => {
  const decision = createHarnessConfirmation(mode, {
    scope: "session",
    unavailable: true,
    onAction: async () => {
      throw Error("Must not dispatch");
    },
    onDismiss: () => {},
  });
  expect(decision!.actions.find((action) => action.id === "approve")?.disabled).toBe(true);
  await expect(decision!.onAction("approve")).rejects.toThrow("unavailable");
  await decision!.onAction("continue");
});
