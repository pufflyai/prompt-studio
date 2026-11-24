import { expect, test } from "bun:test";
import type { ExtensionAutomationApi } from "@pstdio/sdk/extensions";
import { makeCommandContext } from "@pstdio/sdk/testing";
import { startCollection } from "./collection";
import { recoverEnvironmentCleanup, rememberEnvironmentCleanup } from "./environment-cleanup";
import { claimEnvironment } from "./environments";
import { rememberRunLog } from "./run-log";
import { createRunStorage } from "./run-storage-fixture";
import type { RunRecord } from "./runs";

test("background recovery prioritizes lifecycle work and leaves admission room for a new launch", async () => {
  const store = createRunStorage();
  type Job = NonNullable<Awaited<ReturnType<ExtensionAutomationApi["get"]>>>;
  const jobs = new Map<string, Job>();
  const keys = new Map<string, string>();
  const queued: Parameters<ExtensionAutomationApi["enqueue"]>[0][] = [];
  const ctx = makeCommandContext({
    storage: store,
    params: {},
    overrides: {
      logger: { warn: () => {}, error: () => {} },
      automation: {
        get: async (id) => jobs.get(id),
        enqueue: async (input) => {
          const replay = keys.get(input.key);
          if (replay) return jobs.get(replay)!;
          if (jobs.size >= 60) throw new Error("Automation run rate limit exceeded.");
          queued.push(input);
          const commandId = typeof input.command === "string" ? input.command : input.command.id;
          const next: Job = {
            id: `job-${jobs.size}`,
            projectId: "project",
            commandId,
            status: "queued",
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            result: null,
            error: null,
          };
          jobs.set(next.id, next);
          keys.set(input.key, next.id);
          return next;
        },
      },
    },
  });
  const record = (runId: string): RunRecord => ({
    runId,
    environmentId: "env",
    requestId: `request-${runId}`,
    conversationId: "conversation",
    root: "/",
    command: "bun test",
    startedAt: new Date().toISOString(),
    timeoutSeconds: 60,
    stopAfterRun: true,
  });
  for (let index = 0; index < 100; index++) {
    const runId = `collect-${String(index).padStart(3, "0")}`;
    await store.set(`run:${runId}`, record(runId));
  }
  for (let index = 0; index < 8; index++) {
    const runId = `cleanup-${index}`;
    const environmentId = `env-${index}`;
    await claimEnvironment(store, environmentId, runId);
    await rememberEnvironmentCleanup(store, { runId, environmentId, stop: true });
    const logId = `log-${index}`;
    await store.set(`run:${logId}`, {
      ...record(logId),
      summary: {
        runId: logId,
        environmentId: "env",
        status: "timed_out",
        exitCode: null,
        durationMs: 60,
        logPath: null,
        tail: "",
      },
    });
    await rememberRunLog(store, logId);
  }
  await recoverEnvironmentCleanup.run(ctx, {});
  await store.set("run:direct", record("direct"));
  await expect(startCollection(ctx, "direct")).resolves.toBeString();
  const background = queued.slice(0, -1).map((job) => (typeof job.command === "string" ? job.command : job.command.id));
  expect(background).toEqual([
    ...Array(8).fill("environments.cleanup-run"),
    ...Array(8).fill("runs.collect-log"),
    ...Array(4).fill("runs.collect"),
  ]);
  await recoverEnvironmentCleanup.run(ctx, {});
  expect(jobs.size).toBe(21);
});
