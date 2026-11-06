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

test("accepted native command failure remains visible after recovery and refresh without losing newer work", async () => {
  const { saveNativeSubmission } = await import("./native-submission");
  const { recoverNativeInputs, acknowledgeNativeInputs } = await import("./native-recovery");
  const ctx = makeCommandContext({ storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }), params: {} });
  const draft = { text: "/fail", attachments: [], values: { harness: { harnessId: "agent" } } };
  await saveNativeSubmission(ctx, "s", { draft, operation: { kind: "command", text: "/fail" } }, "old", true);
  const session = { status: "failed", lastRequestStarted: "new" };
  const recovered: unknown[] = [];
  await recoverNativeInputs(ctx, "s", session, async (body) => {
    recovered.push(body);
  });
  await acknowledgeNativeInputs(ctx, "s", { text: "Newer work", attachments: [], values: {}, recovered: [draft] });
  const read = () => nativePresentation(ctx, "s", undefined, "agent", undefined, session);
  expect(recovered).toEqual([draft]);
  expect((await read()).notice).toContain("Native command /fail failed");
  expect((await read()).notice).toContain("Native command /fail failed");
  expect(
    (await nativePresentation(ctx, "s", undefined, "agent", undefined, { ...session, status: "completed" })).notice,
  ).toBe("");
});

test("a later ordinary failure cannot revive an already recovered native command error", async () => {
  const { saveNativeSubmission } = await import("./native-submission");
  const { recoverNativeInputs, acknowledgeNativeInputs } = await import("./native-recovery");
  const ctx = makeCommandContext({ storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }), params: {} });
  const draft = { text: "/fail", attachments: [], values: {} };
  await saveNativeSubmission(ctx, "s", { draft, operation: { kind: "command", text: "/fail" } }, "before", true);
  await recoverNativeInputs(ctx, "s", { status: "failed", lastRequestStarted: "native" }, async () => {});
  await acknowledgeNativeInputs(ctx, "s", draft);
  expect(
    (
      await nativePresentation(ctx, "s", undefined, "agent", undefined, {
        status: "failed",
        lastRequestStarted: "native",
      })
    ).notice,
  ).toContain("/fail");
  expect(
    (
      await nativePresentation(ctx, "s", undefined, "agent", undefined, {
        status: "completed",
        lastRequestStarted: "ordinary",
      })
    ).notice,
  ).toBe("");
  expect(
    (
      await nativePresentation(ctx, "s", undefined, "agent", undefined, {
        status: "failed",
        lastRequestStarted: "later",
      })
    ).notice,
  ).toBe("");
});
