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
  expect(await execute("auto-build.select-model", { supervisorModel })).toMatchObject({
    enabled: false,
    supervisorModel,
  });
  expect(await execute("auto-build.read", {})).toMatchObject({ supervisorModel });
  await execute("auto-build.select-model", { supervisorModel: { harnessId: supervisorModel.harnessId } });
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
  });
  await expectScopedAutoBuild(execute);
  expect(await execute("auto-build.configure", { enabled: false })).toMatchObject({
    enabled: false,
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
