import { expect, test } from "bun:test";
import type { HarnessCommandState } from "@pstdio/sdk/extensions";
import { decisionSnapshot, harnessConfirmationId } from "./harness-confirmation";

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
test("native approval presentation carries the displayed revision, model and cancel semantics", () => {
  expect(decisionSnapshot("session", mode)).toEqual({
    id: harnessConfirmationId("session", mode),
    model: "native-model",
    modeSnapshot: mode,
    actions: [
      { id: "skip", label: "Skip", variant: "ghost" },
      { id: "continue", label: "Keep planning", variant: "subtle" },
      { id: "approve", label: "Approve and implement", variant: "primary" },
    ],
  });
});
test("unavailable native confirmations are not offered", () => {
  expect(decisionSnapshot("session")).toBeNull();
  expect(decisionSnapshot("session", { ...mode, actions: [] })).toBeNull();
});
