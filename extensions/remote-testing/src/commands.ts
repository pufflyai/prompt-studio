import { type CommandContext, defineCommand, params, workbenchPages } from "@pstdio/sdk/extensions";
import { connectionApi } from "./connection";
import { changed, googleToken, projectRoot, runDeps } from "./context";
import { createEnvironment, isBusy, listEnvironments, stopEnvironment } from "./environments";
import { awaitRun, cancelRun, listRuns, readRun, startRun } from "./runs";
import { sessionResource } from "./session-link";
import { readSettings } from "./settings";

// Table row actions pass the row as `rowId`; the CLI names it explicitly.
const runParams = {
  runId: params.text({ label: "Run ID" }),
  rowId: params.text({ label: "Run row" }),
};
const runOf = (input: { runId?: string; rowId?: string }) => {
  const id = input.runId || input.rowId;
  if (!id) throw new Error("Pass --run-id <id>. List runs with: pst pocketcoder.remote-testing runs list");
  return id;
};

export const status = defineCommand({
  id: "status",
  title: "Check remote testing",
  cli: { description: "Check that remote testing is configured and reachable, and list environments." },
  async run(ctx) {
    const { settings, problems } = readSettings(await ctx.settings.all());
    if (problems.length) return { available: false, problems };
    try {
      const environments = await listEnvironments(connectionApi(ctx.connections), ctx.projectId);
      await googleToken(ctx);
      return {
        available: true,
        template: `${settings.templateName}@${settings.templateVersion}`,
        testCommand: settings.testCommand,
        environments: await Promise.all(
          environments.map(async (item) => ({
            id: item.id,
            state: item.state,
            busy: await isBusy(ctx.storage, item.id),
          })),
        ),
      };
    } catch (error) {
      return { available: false, problems: [error instanceof Error ? error.message : String(error)] };
    }
  },
});

const collectRun = defineCommand({
  id: "runs.collect",
  title: "Collect remote test result",
  automation: true,
  params: { runId: params.text({ label: "Run ID", required: true }) },
  async run(ctx, { runId }) {
    return awaitRun(await runDeps(ctx), await readRun(ctx.storage, runId), ctx.signal);
  },
});

export async function startCollection(ctx: CommandContext, runId: string) {
  const key = `collector:${runId}`;
  const priorId = await ctx.storage.get<string>(key);
  const prior = priorId ? await ctx.automation.get(priorId) : undefined;
  if (prior && ["queued", "running", "succeeded"].includes(prior.status)) return prior.id;
  const job = await ctx.automation.enqueue({
    command: collectRun.ref,
    input: { params: { runId } },
    key: `remote-tests:collect:${runId}:${priorId ?? "first"}`,
  });
  await ctx.storage.set(key, job.id);
  return job.id;
}

async function waitForCollection(ctx: CommandContext, runId: string, jobId: string) {
  while (true) {
    ctx.signal.throwIfAborted();
    const job = await ctx.automation.get(jobId);
    if (!job) throw new Error("The remote test collector is unavailable.");
    if (job.status === "succeeded") {
      const result = (await readRun(ctx.storage, runId)).summary;
      if (!result) throw new Error("The remote test collector did not save a result.");
      return result;
    }
    if (job.status !== "queued" && job.status !== "running")
      throw new Error(job.error?.message ?? `Could not collect the remote test result. Status ${job.status}.`);
    await Bun.sleep(1000);
  }
}

export const run = defineCommand({
  id: "run",
  title: "Run tests remotely",
  cli: {
    description: "Upload the working tree, run the test command in a remote environment and wait for the result.",
  },
  mutating: true,
  params: {
    path: params.text({ label: "Repository folder (default: this workspace)" }),
    ref: params.text({ label: "Git ref (default: working tree)" }),
    branchTemplate: params.boolean({ label: "Publish a template for this snapshot", default: false }),
    command: params.text({ label: "Command (default: the configured test command)" }),
    environment: params.text({ label: "Environment ID (default: create an isolated one)" }),
    timeoutMinutes: params.number({ label: "Timeout in minutes" }),
    wait: params.boolean({ label: "Wait for the result", default: true }),
    keepEnvironment: params.boolean({ label: "Keep the environment after the run", default: false }),
    // pst fills this from the calling agent's session, so runs link back to it.
    sessionId: params.text({ label: "Session that started the run" }),
  },
  async run(ctx, input) {
    const deps = await runDeps(ctx);
    const started = await startRun(
      deps,
      {
        root: input.path || (await projectRoot(ctx)),
        command: input.command,
        environmentId: input.environment,
        timeoutMinutes: input.timeoutMinutes,
        sessionId: input.sessionId,
        keepEnvironment: input.keepEnvironment,
        ref: input.ref,
        branchTemplate: input.branchTemplate,
      },
      ctx.signal,
    );
    const { runId, environmentId } = started.record;
    const collector = await startCollection(ctx, runId);
    if (input.wait === false) return { runId, environmentId, status: "running", template: started.record.template };
    return waitForCollection(ctx, runId, collector);
  },
});

export const showRun = defineCommand({
  id: "runs.show",
  title: "Wait for a remote test run",
  cli: { description: "Wait for a run to finish and print its result and log path." },
  params: runParams,
  async run(ctx, input) {
    const record = await readRun(ctx.storage, runOf(input));
    if (record.summary) return record.summary;
    if (record.stopAfterRun === undefined) return awaitRun(await runDeps(ctx), record, ctx.signal);
    return waitForCollection(ctx, record.runId, await startCollection(ctx, record.runId));
  },
});

export const listRunsCommand = defineCommand({
  id: "runs.list",
  title: "List remote test runs",
  cli: { description: "List recent runs started from this project." },
  async run(ctx) {
    return (await listRuns(ctx.storage)).map((record) => ({
      runId: record.runId,
      environmentId: record.environmentId,
      sessionId: record.sessionId ?? null,
      command: record.command,
      startedAt: record.startedAt,
      status: record.summary?.status ?? "running",
      logPath: record.summary?.logPath ?? null,
    }));
  },
});

export const cancelRunCommand = defineCommand({
  id: "runs.cancel",
  title: "Cancel test run",
  cli: {
    description: "Cancel a running test. The environment stops unless the run was started with --keep-environment.",
  },
  mutating: true,
  params: runParams,
  async run(ctx, input) {
    const runId = runOf(input);
    const canceled = await cancelRun(await runDeps(ctx), await readRun(ctx.storage, runId));
    await ctx.events.emit(changed, {});
    return { runId, canceled };
  },
});

export const openSession = defineCommand({
  id: "runs.open-session",
  title: "Open the session that started this run",
  params: runParams,
  async run(ctx, input) {
    const record = await readRun(ctx.storage, runOf(input));
    const resource = record.sessionId ? await sessionResource(ctx, record.sessionId) : null;
    if (!resource) throw new Error("This run was not started from a Prompt Studio session.");
    ctx.navigation.open({ kind: "page", page: workbenchPages.session, resource });
    return { sessionId: resource.id };
  },
});

export const listEnvironmentsCommand = defineCommand({
  id: "environments.list",
  title: "List remote test environments",
  cli: { description: "List running test environments of the configured template." },
  async run(ctx) {
    const { api, settings, store } = await runDeps(ctx);
    return Promise.all(
      (await listEnvironments(api, ctx.projectId)).map(async (item) => ({
        id: item.id,
        state: item.state,
        busy: await isBusy(store, item.id),
        createdAt: item.created_at,
        deadlineAt: item.deadline_at,
      })),
    );
  },
});

export const createEnvironmentCommand = defineCommand({
  id: "environments.create",
  title: "Start test environment",
  cli: { description: "Start an environment ahead of time, then select it with run --environment <id>." },
  mutating: true,
  async run(ctx) {
    const { api, settings } = await runDeps(ctx);
    const created = await createEnvironment(api, settings, ctx.signal, { pstdio_project_id: ctx.projectId });
    await ctx.events.emit(changed, {});
    return { id: created.id, state: created.state };
  },
});

export const stopEnvironmentCommand = defineCommand({
  id: "environments.stop",
  title: "Stop test environment",
  cli: { description: "Stop one environment, or all of them with --all." },
  mutating: true,
  params: {
    environment: params.text({ label: "Environment ID" }),
    rowId: params.text({ label: "Environment row" }),
    all: params.boolean({ label: "Stop every environment", default: false }),
  },
  async run(ctx, input) {
    const { api, settings } = await runDeps(ctx);
    const ids = input.all
      ? (await listEnvironments(api, ctx.projectId)).map((item) => item.id)
      : [input.environment || input.rowId];
    if (!ids[0]) throw new Error("Pass --environment <id> or --all.");
    const stopped = await Promise.all(ids.map((id) => stopEnvironment(api, id as string)));
    await ctx.events.emit(changed, {});
    return stopped.map((item) => ({ id: item.id, state: item.state }));
  },
});

export const stopAllEnvironments = defineCommand({
  id: "environments.stop-all",
  title: "Stop all test environments",
  mutating: true,
  async run(ctx) {
    const { api, settings } = await runDeps(ctx);
    const stopped = await Promise.all(
      (await listEnvironments(api, ctx.projectId)).map((item) => stopEnvironment(api, item.id)),
    );
    await ctx.events.emit(changed, {});
    return { stopped: stopped.length };
  },
});

export const refresh = defineCommand({
  id: "refresh",
  title: "Refresh remote tests",
  async run(ctx) {
    await ctx.events.emit(changed, {});
    return {};
  },
});

export const commands = [
  status,
  run,
  showRun,
  collectRun,
  listRunsCommand,
  cancelRunCommand,
  openSession,
  listEnvironmentsCommand,
  createEnvironmentCommand,
  stopEnvironmentCommand,
  stopAllEnvironments,
  refresh,
];
