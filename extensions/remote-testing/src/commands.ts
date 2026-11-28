import { defineCommand, l10n, params, workbenchPages } from "@pstdio/sdk/extensions";
import { collectRun, startCollection, waitForCollection } from "./collection";
import { connectionApi } from "./connection";
import { changed, checkAccess, projectRoot, runDeps } from "./context";
import { cleanupEnvironmentCommand, recoverEnvironmentCleanup } from "./environment-cleanup";
import { createEnvironment, isBusy, listEnvironments, stopEnvironment } from "./environments";
import { collectRunLog } from "./run-log";
import { awaitRun, cancelRun, listRuns, readRun, startRun } from "./runs";
import { sessionResource } from "./session-link";
import { readSettings } from "./settings";
import { waitForRunSetup } from "./setup-claims";

// Table row actions pass the row as `rowId`; the CLI names it explicitly.
const runParams = {
  runId: params.text({ label: l10n("remote-testing.run-id", "Run ID") }),
  rowId: params.text({ label: l10n("remote-testing.run-row", "Run row") }),
};
const runOf = (input: { runId?: string; rowId?: string }) => {
  const id = input.runId || input.rowId;
  if (!id) throw new Error("Pass --run-id <id>. List runs with: pst pocketcoder.remote-testing runs list");
  return id;
};

export const status = defineCommand({
  id: "status",
  title: l10n("remote-testing.check-remote-testing", "Check remote testing"),
  cli: {
    description: l10n(
      "remote-testing.check-that-remote-testing-is-configured-and-reachable-and-list-environments",
      "Check that remote testing is configured and reachable, and list environments.",
    ),
  },
  async run(ctx) {
    const { settings, problems, kitoWorkflow } = readSettings(await ctx.settings.all());
    if (problems.length) return { available: false, problems };
    try {
      const environments = await listEnvironments(connectionApi(ctx.connections), ctx.projectId);
      await checkAccess(ctx, kitoWorkflow);
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

export const run = defineCommand({
  id: "run",
  title: l10n("remote-testing.run-tests-remotely", "Run tests remotely"),
  cli: {
    description: l10n(
      "remote-testing.upload-the-working-tree-run-the-test-command-in-a-remote-environment-and-wait-for-the-result",
      "Upload the working tree, run the test command in a remote environment and wait for the result.",
    ),
  },
  mutating: true,
  params: {
    path: params.text({
      label: l10n(
        "remote-testing.repository-folder-default-this-workspace",
        "Repository folder (default: this workspace)",
      ),
    }),
    ref: params.text({ label: l10n("remote-testing.git-ref-default-working-tree", "Git ref (default: working tree)") }),
    base: params.text({ label: l10n("remote-testing.comparison-base", "Comparison base (default: origin/main)") }),
    branchTemplate: params.boolean({
      label: l10n("remote-testing.publish-a-template-for-this-snapshot", "Publish a template for this snapshot"),
      default: false,
    }),
    command: params.text({
      label: l10n(
        "remote-testing.command-default-the-configured-test-command",
        "Command (default: the configured test command)",
      ),
    }),
    environment: params.text({
      label: l10n(
        "remote-testing.environment-id-default-create-an-isolated-one",
        "Environment ID (default: create an isolated one)",
      ),
    }),
    timeoutMinutes: params.number({ label: l10n("remote-testing.timeout-in-minutes", "Timeout in minutes") }),
    wait: params.boolean({ label: l10n("remote-testing.wait-for-the-result", "Wait for the result"), default: true }),
    keepEnvironment: params.boolean({
      label: l10n("remote-testing.keep-the-environment-after-the-run", "Keep the environment after the run"),
      default: false,
    }),
    // pst fills this from the calling agent's session, so runs link back to it.
    sessionId: params.text({
      label: l10n("remote-testing.session-that-started-the-run", "Session that started the run"),
    }),
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
        base: input.base,
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
  title: l10n("remote-testing.wait-for-a-remote-test-run", "Wait for a remote test run"),
  cli: {
    description: l10n(
      "remote-testing.wait-for-a-run-to-finish-and-print-its-result-and-log-path",
      "Wait for a run to finish and print its result and log path.",
    ),
  },
  params: runParams,
  async run(ctx, input) {
    let record = await waitForRunSetup(ctx, runOf(input), ctx.signal);
    if (record.pendingResult) {
      await collectRun.run(ctx, { runId: record.runId });
      record = await readRun(ctx.storage, record.runId);
    }
    if (record.summary) return record.summary;
    if (record.stopAfterRun === undefined) return awaitRun(await runDeps(ctx), record, ctx.signal);
    return waitForCollection(ctx, record.runId, await startCollection(ctx, record.runId));
  },
});

export const listRunsCommand = defineCommand({
  id: "runs.list",
  title: l10n("remote-testing.list-remote-test-runs", "List remote test runs"),
  cli: {
    description: l10n(
      "remote-testing.list-recent-runs-started-from-this-project",
      "List recent runs started from this project.",
    ),
  },
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
  title: l10n("remote-testing.cancel-test-run", "Cancel test run"),
  cli: {
    description: l10n(
      "remote-testing.cancel-a-running-test-the-environment-stops-unless-the-run-was-started-with-keep-environment",
      "Cancel a running test. The environment stops unless the run was started with --keep-environment.",
    ),
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
  title: l10n("remote-testing.open-the-session-that-started-this-run", "Open the session that started this run"),
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
  title: l10n("remote-testing.list-remote-test-environments", "List remote test environments"),
  cli: {
    description: l10n(
      "remote-testing.list-running-test-environments-of-the-configured-template",
      "List running test environments of the configured template.",
    ),
  },
  async run(ctx) {
    const { api, store } = await runDeps(ctx);
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
  title: l10n("remote-testing.start-test-environment", "Start test environment"),
  cli: {
    description: l10n(
      "remote-testing.start-an-environment-ahead-of-time-then-select-it-with-run-environment-id",
      "Start an environment ahead of time, then select it with run --environment <id>.",
    ),
  },
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
  title: l10n("remote-testing.stop-test-environment", "Stop test environment"),
  cli: {
    description: l10n(
      "remote-testing.stop-one-environment-or-all-of-them-with-all",
      "Stop one environment, or all of them with --all.",
    ),
  },
  mutating: true,
  params: {
    environment: params.text({ label: l10n("remote-testing.environment-id", "Environment ID") }),
    rowId: params.text({ label: l10n("remote-testing.environment-row", "Environment row") }),
    all: params.boolean({
      label: l10n("remote-testing.stop-every-environment", "Stop every environment"),
      default: false,
    }),
  },
  async run(ctx, input) {
    const { api } = await runDeps(ctx);
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
  title: l10n("remote-testing.stop-all-test-environments", "Stop all test environments"),
  mutating: true,
  async run(ctx) {
    const { api } = await runDeps(ctx);
    const stopped = await Promise.all(
      (await listEnvironments(api, ctx.projectId)).map((item) => stopEnvironment(api, item.id)),
    );
    await ctx.events.emit(changed, {});
    return { stopped: stopped.length };
  },
});

export const refresh = defineCommand({
  id: "refresh",
  title: l10n("remote-testing.refresh-remote-tests", "Refresh remote tests"),
  async run(ctx) {
    await ctx.events.emit(changed, {});
    return {};
  },
});

export const commands = [
  cleanupEnvironmentCommand,
  recoverEnvironmentCleanup,
  status,
  run,
  showRun,
  collectRun,
  collectRunLog,
  listRunsCommand,
  cancelRunCommand,
  openSession,
  listEnvironmentsCommand,
  createEnvironmentCommand,
  stopEnvironmentCommand,
  stopAllEnvironments,
  refresh,
];
