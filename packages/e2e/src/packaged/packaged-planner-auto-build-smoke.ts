import { expect } from "bun:test";
import { expectPackagedDependencyBlockers } from "./packaged-planner-blockers-smoke";
import { commandRunner, configurePlannerWorkflow, type PackagedPlanner } from "./packaged-planner-helpers";

export async function expectPackagedPlannerAutoBuild(input: PackagedPlanner) {
  const execute = commandRunner(input);
  const inactive = await execute("create-ticket", { content: "# Work with Auto Build off", status: "Todo" });
  await execute("auto-build.check", {});
  expect(await execute("get-ticket", { id: inactive.id })).toMatchObject({ statusId: inactive.statusId });
  await execute("delete-ticket", { id: inactive.id });
  // Empty ready work exercises the shipped action without starting real agents.
  expect(await execute("auto-build", {})).toEqual({ prompted: false });
  expect(await execute("auto-build.read", {})).toMatchObject({
    enabled: false,
    completed: false,
    eligible: { conjunction: "and", rules: [] },
  });
  const supervisorModel = { harnessId: "pstdio.harness-codex.harness.codex", model: "smoke-model" };
  expect(await execute("auto-build.configure", { enabled: false, supervisorModel })).toMatchObject({
    enabled: false,
    supervisorModel,
  });
  expect(await execute("auto-build.read", {})).toMatchObject({ supervisorModel });
  await execute("auto-build.configure", { enabled: false, supervisorModel: { harnessId: supervisorModel.harnessId } });
  const { selections, statusId } = await configurePlannerWorkflow(execute);
  expect(await execute("workflow-statuses.read", {})).toMatchObject({ selections, missingStatusIds: [] });
  expect((await execute("implementation-policy", {})).workflow.selections).toEqual(selections);
  const eligible = {
    conjunction: "and",
    rules: [{ attributeId: "status", condition: "is-any-of", value: [statusId("Todo")] }],
  };
  expect(
    await execute("auto-build.configure", {
      enabled: true,
      prompt: "Choose valid tasks.",
      eligible,
      requireMergedDependencies: false,
    }),
  ).toMatchObject({ enabled: true, eligible, requireMergedDependencies: false });
  expect(await execute("auto-build.candidates", {})).toMatchObject({ enabled: true, candidates: [] });
  await execute("auto-build.check", {});
  expect(await execute("next-tickets", {})).toMatchObject({ enabled: true, tickets: [], waiting: [] });
  // An idle project without actionable work must not start a supervisor on repeated background checks.
  for (let check = 0; check < 3; check++) expect(await execute("auto-build", {})).toEqual({ prompted: false });
  expect(await execute("auto-build.read", {})).toMatchObject({
    enabled: true,
    prompt: "Choose valid tasks.",
    stuck: false,
    completed: false,
    supervisor: null,
    matchingTicketCount: 0,
    readyTicketCount: 0,
    waitingTickets: [],
  });
  await expectScopedAutoBuild(execute);
  const beforePause = await execute("auto-build.read", {});
  expect(await execute("auto-build.pause", {})).toMatchObject({
    state: "paused",
    enabled: false,
    revision: beforePause.revision,
  });
  expect(await execute("auto-build", {})).toEqual({ prompted: false });
  const resumed = await execute("auto-build.resume", {});
  expect(resumed).toMatchObject({ state: "running", enabled: true, prompt: beforePause.prompt });
  expect(resumed.revision).not.toBe(beforePause.revision);
  expect(await execute("next-tickets", {})).toMatchObject({ tickets: [], waiting: [] });
  await execute("auto-build.pause", {});
  expect(await execute("auto-build.configure", { enabled: false })).toMatchObject({
    enabled: false,
  });
  expect(await execute("auto-build", {})).toEqual({ prompted: false });
  const stopped = await execute("auto-build.read", {});
  const restarted = await execute("auto-build.configure", { enabled: true });
  expect(restarted).toMatchObject({ enabled: true, prompt: "Choose valid tasks.", blockOnReview: false });
  expect(restarted.revision).not.toBe(stopped.revision);
  expect(await execute("auto-build.read", {})).toMatchObject({ supervisor: null });
  await execute("auto-build.configure", { enabled: false });
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
