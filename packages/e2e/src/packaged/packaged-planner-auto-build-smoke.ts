import { expect } from "bun:test";
import { expectPackagedDependencyBlockers } from "./packaged-planner-blockers-smoke";
import { commandRunner, type PackagedPlanner } from "./packaged-planner-helpers";

export async function expectPackagedPlannerAutoBuild(input: PackagedPlanner) {
  const execute = commandRunner(input);
  // Empty ready work exercises the shipped action without starting real agents.
  expect(await execute("auto-build", {})).toEqual({ prompted: false });
  expect(await execute("auto-build.read", {})).toMatchObject({ enabled: false, blockOnReview: true });
  expect(
    await execute("auto-build.configure", { enabled: true, prompt: "Choose valid tasks.", blockOnReview: false }),
  ).toMatchObject({
    enabled: true,
    blockOnReview: false,
    storageOutcome: { status: "saved-locally", operationId: expect.any(String) },
  });
  expect(await execute("auto-build.candidates", {})).toMatchObject({ enabled: true, candidates: [] });
  expect(await execute("next-tickets", {})).toMatchObject({ enabled: true, tickets: [], waiting: [] });
  // An idle project without actionable work must not start a supervisor on repeated background checks.
  for (let check = 0; check < 3; check++) expect(await execute("auto-build", {})).toEqual({ prompted: false });
  expect(await execute("auto-build.read", {})).toMatchObject({
    enabled: true,
    prompt: "Choose valid tasks.",
    blockOnReview: false,
    stuck: false,
    supervisor: null,
  });
  await expectScopedAutoBuild(execute);
  expect(await execute("auto-build.configure", { enabled: false })).toMatchObject({
    enabled: false,
    storageOutcome: { status: "saved-locally", operationId: expect.any(String) },
  });
  expect(await execute("auto-build", {})).toEqual({ prompted: false });
  await expectPackagedDependencyBlockers({ ...input, execute });
}

type Execute = ReturnType<typeof commandRunner>;

async function expectScopedAutoBuild(execute: Execute) {
  const { revision } = await execute("auto-build.read", {});
  expect(await execute("auto-build.scope", { revision, queries: [{ status: "Blocked" }] })).toMatchObject({
    tickets: [],
  });
  const outside = await execute("create-ticket", {
    content: "# Ready work outside the supervisor scope",
    status: "Todo",
  });
  expect(await execute("next-tickets", {})).toMatchObject({ tickets: [], waiting: [] });
  for (let check = 0; check < 3; check++) expect(await execute("auto-build", {})).toEqual({ prompted: false });
  expect(await execute("auto-build.dispatch", { revision, ticket: outside.id })).toMatchObject({
    decision: "wait",
    reason: "ticket-not-ready",
  });
  expect(await execute("auto-build.read", {})).toMatchObject({ supervisor: null });
  await execute("delete-ticket", { id: outside.id });
}
