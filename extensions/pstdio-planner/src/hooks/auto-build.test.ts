import { expect, test } from "bun:test";
import type { AutomationRun } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { configureAutoBuildCommand, readAutoBuildCommand } from "../commands/auto-build-mode";
import { makeCommandContext } from "../commands/command-context.fixture";
import { saveAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { statusesCollection } from "../data/collections";
import {
  autoBuildSchedule,
  autoBuildSessionCompletedHook,
  checkAutoBuildCommand,
  enqueueAutoBuild,
} from "./auto-build";

function fixture() {
  const runs: AutomationRun[] = [];
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      automation: {
        list: async (filter) => runs.filter(({ status }) => !filter?.status || filter.status.includes(status)),
        enqueue: async () => {
          const run: AutomationRun = {
            id: crypto.randomUUID(),
            projectId: "proj-1",
            commandId: "pstdio-planner.command.auto-build",
            status: "queued",
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            result: null,
            error: null,
          };
          runs.push(run);
          return run;
        },
      },
    },
  });
  return { ctx, runs };
}

test("the recurring check is eligible only while Auto Build is on and does not initialize an idle project", async () => {
  const { ctx } = fixture();
  const { enabledWhen } = autoBuildSchedule;
  expect(await enabledWhen(ctx)).toBe(false);
  await checkAutoBuildCommand.run(ctx, {});
  expect(await statusesCollection(ctx.storage).list()).toEqual([]);
  await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "Choose relevant work." });
  expect(await enabledWhen(ctx)).toBe(true);
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  expect(await enabledWhen(ctx)).toBe(false);
});

test("enabling the project mode queues a background check", async () => {
  const { ctx, runs } = fixture();
  await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "Choose relevant work." });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    enabled: true,
    running: true,
  });
  expect(runs).toHaveLength(1);
});

test("concurrent events share the active check and later changes can enqueue again", async () => {
  const { ctx, runs } = fixture();
  await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "Choose relevant work." });
  runs[0]!.status = "succeeded";
  await Promise.all([enqueueAutoBuild(ctx), enqueueAutoBuild(ctx), enqueueAutoBuild(ctx)]);
  expect(runs).toHaveLength(2);
  await enqueueAutoBuild(ctx);
  expect(runs).toHaveLength(2);
  runs[1]!.status = "succeeded";
  await enqueueAutoBuild(ctx);
  expect(runs).toHaveLength(3);
});

test("turning off saves the project mode and events no longer queue checks", async () => {
  const { ctx, runs } = fixture();
  await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "Choose relevant work." });
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  runs[0]!.status = "succeeded";
  await enqueueAutoBuild(ctx);
  expect(runs).toHaveLength(1);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
});

test("supervisor completion does not enqueue another supervisor check", async () => {
  const { ctx, runs } = fixture();
  await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "Choose relevant work." });
  await saveAutoBuildSupervisor(ctx, { sessionId: "supervisor" });
  runs[0]!.status = "succeeded";
  const eventContext = { ...ctx, eventId: "pstdio.event.session.completed", deliveryId: "completion" };
  await autoBuildSessionCompletedHook.run(eventContext, {
    sessionId: "supervisor",
    projectId: "proj-1",
    sessionStatus: "completed",
  });
  expect(runs).toHaveLength(1);
  await autoBuildSessionCompletedHook.run(eventContext, {
    sessionId: "implementation",
    projectId: "proj-1",
    sessionStatus: "completed",
  });
  expect(runs).toHaveLength(2);
});

test("shows background launch errors from the host run", async () => {
  const { ctx, runs } = fixture();
  await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "Choose relevant work." });
  runs[0]!.status = "succeeded";
  runs[0]!.error = { code: "supervisor-failed", message: "Agent unavailable", retryable: false };
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ error: "Agent unavailable", running: false });
});
