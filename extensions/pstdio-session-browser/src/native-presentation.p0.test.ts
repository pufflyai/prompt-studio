import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { harnessConfirmationId } from "./harness-confirmation";
import { nativeAction } from "./native-actions";
import { nativePresentation } from "./native-presentation";
import { nativeSubmissionIndex } from "./native-submission";

const confirmation = (id: string, revision: string) => ({
  id,
  label: id,
  description: "",
  state: "ready",
  actions: [{ id: "accept", label: "Accept" }],
  confirmation: { id: revision, actionId: "accept", title: "Review" },
});

test("each native refresh supplies every pending revision while actions dismiss only the visible decision", async () => {
  const plan = confirmation("plan", "revision-1");
  const goal = confirmation("goal", "revision-1");
  const state = { harnessId: "agent", commands: [], modes: [plan, goal], slashCommands: true };
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    overrides: { sessions: { getHarnessCommands: async () => state } },
  });
  const presentation = () => nativePresentation(ctx, "s", state, "agent");
  const planId = harnessConfirmationId("s", plan);
  const goalId = harnessConfirmationId("s", goal);
  expect((await presentation()).decisions?.map((decision) => decision.id)).toEqual([planId, goalId]);
  const values = { harness: { harnessId: "agent" } };
  for (const [mode, actionId] of [
    [plan, "skip"],
    [goal, "continue"],
  ] as const) {
    expect(
      await nativeAction(ctx, "s", {
        type: "decision",
        id: harnessConfirmationId("s", mode),
        actionId,
        values,
        modeSnapshot: mode,
      }),
    ).toMatchObject({ snapshot: { decision: null } });
    expect((await presentation()).decisions?.map((decision) => decision.id)).toEqual([planId, goalId]);
  }
  expect(await nativeAction(ctx, "s", { type: "confirmation", modeId: "goal", values })).toMatchObject({
    snapshot: { decision: { id: goalId, modeSnapshot: goal } },
  });
  state.modes = [confirmation("plan", "revision-2"), goal];
  expect((await presentation()).decisions?.map((decision) => decision.id)).toEqual([
    harnessConfirmationId("s", state.modes[0]!),
    goalId,
  ]);
});
