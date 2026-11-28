import {
  type DataTableRendererRowActivationHandler,
  defineView,
  l10n,
  viewDataEvents,
  workbenchPages,
} from "@pstdio/sdk/extensions";
import { runPromptStudio } from "./branch-commands";
import {
  cancelRunCommand,
  createEnvironmentCommand,
  openSession,
  refresh,
  run,
  stopAllEnvironments,
  stopEnvironmentCommand,
} from "./commands";
import { changed, runDeps } from "./context";
import { resumeEnvironmentCleanups } from "./environment-cleanup";
import { activeRun, listEnvironments } from "./environments";
import { environmentValues, runValues } from "./run-rows";
import { checkRun, listRuns } from "./runs";
import { sessionResource } from "./session-link";

const refreshAction = {
  id: "refresh",
  label: l10n("remote-testing.refresh", "Refresh"),
  icon: "refresh-cw",
  command: refresh.ref,
};

// Double-clicking a run opens the session that started it.
const openRunSession: DataTableRendererRowActivationHandler = (ctx, { row }) => {
  if (row.resource) ctx.navigation.open({ kind: "page", page: workbenchPages.session, resource: row.resource });
};

export const runsView = defineView({
  id: "runs",
  title: l10n("remote-testing.test-runs", "Test runs"),
  icon: "flask-conical",
  body: {
    kind: "dataTable",
    refreshEvents: [changed, viewDataEvents.sessionsChanged],
    emptyTitle: l10n("remote-testing.no-remote-test-runs-yet", "No remote test runs yet"),
    emptyDescription: l10n(
      "remote-testing.agents-start-runs-with-pst-pocketcoder-remote-testing-run",
      "Agents start runs with pst pocketcoder.remote-testing run.",
    ),
    toolbarActions: [
      {
        id: "run-tests",
        label: l10n("remote-testing.run-tests", "Run tests"),
        icon: "flask-conical",
        presentation: "primary",
        command: run.ref,
        input: run.params,
      },
      {
        id: "run-prompt-studio",
        label: l10n("remote-testing.run-prompt-studio", "Run Prompt Studio"),
        icon: "play",
        command: runPromptStudio.ref,
        input: runPromptStudio.params,
      },
      refreshAction,
    ],
    columns: [
      { id: "status", label: l10n("remote-testing.status", "Status"), groupable: true },
      { id: "command", label: l10n("remote-testing.command", "Command") },
      { id: "session", label: l10n("remote-testing.started-by", "Started by"), groupable: true },
      { id: "environment", label: l10n("remote-testing.environment", "Environment"), groupable: true },
      { id: "started", label: l10n("remote-testing.started", "Started"), type: "date" },
      { id: "duration", label: l10n("remote-testing.duration-s", "Duration (s)"), type: "number" },
      { id: "exitCode", label: l10n("remote-testing.exit-code", "Exit code"), type: "number" },
      { id: "log", label: l10n("remote-testing.log", "Log") },
    ],
    rowActions: [
      {
        id: "session",
        label: l10n("remote-testing.open-session", "Open session"),
        icon: "messages-square",
        command: openSession.ref,
      },
      {
        id: "cancel",
        label: l10n("remote-testing.cancel-run", "Cancel run"),
        icon: "square",
        destructive: true,
        command: cancelRunCommand.ref,
      },
    ],
    onRowActivate: openRunSession,
    defaultSorts: [{ attributeId: "started", direction: "desc" }],
    async query(ctx) {
      await resumeEnvironmentCleanups(ctx);
      const records = await listRuns(ctx.storage);
      // Older runs may have been submitted before background collection was available.
      const deps = await runDeps(ctx, { recover: false }).catch(() => null);
      const now = new Date();
      return {
        rows: await Promise.all(
          records.map(async (record) => {
            const summary =
              deps && !record.summary && record.stopAfterRun === undefined
                ? await checkRun(deps, record).catch(() => null)
                : null;
            const current = summary ? { ...record, summary } : record;
            const resource = record.sessionId ? await sessionResource(ctx, record.sessionId) : null;
            return {
              id: record.runId,
              ...(resource ? { resource } : {}),
              values: runValues(current, resource?.label ?? null, now),
            };
          }),
        ),
      };
    },
  },
});

export const environmentsView = defineView({
  id: "environments",
  title: l10n("remote-testing.test-environments", "Test environments"),
  icon: "server",
  body: {
    kind: "dataTable",
    refreshEvents: [changed],
    emptyTitle: l10n("remote-testing.no-test-environments-are-running", "No test environments are running"),
    emptyDescription: l10n(
      "remote-testing.a-run-starts-an-environment-when-it-needs-one-and-stops-it-when-the-run-finishes",
      "A run starts an environment when it needs one and stops it when the run finishes.",
    ),
    toolbarActions: [
      {
        id: "start",
        label: l10n("remote-testing.start-environment", "Start environment"),
        icon: "plus",
        presentation: "primary",
        command: createEnvironmentCommand.ref,
      },
      {
        id: "stop-all",
        label: l10n("remote-testing.stop-all", "Stop all"),
        icon: "square",
        command: stopAllEnvironments.ref,
      },
      refreshAction,
    ],
    columns: [
      { id: "environment", label: l10n("remote-testing.environment", "Environment") },
      { id: "state", label: l10n("remote-testing.state", "State"), groupable: true },
      { id: "activity", label: l10n("remote-testing.activity", "Activity") },
      { id: "template", label: l10n("remote-testing.template", "Template"), groupable: true },
      { id: "started", label: l10n("remote-testing.started", "Started"), type: "date" },
      { id: "stopsAt", label: l10n("remote-testing.stops-at", "Stops at"), type: "date" },
    ],
    rowActions: [
      {
        id: "stop",
        label: l10n("remote-testing.stop-environment", "Stop environment"),
        icon: "square",
        destructive: true,
        command: stopEnvironmentCommand.ref,
      },
    ],
    async query(ctx) {
      const { api, settings, store } = await runDeps(ctx);
      return {
        rows: await Promise.all(
          (await listEnvironments(api, ctx.projectId)).map(async (environment) => ({
            id: environment.id,
            values: environmentValues(environment, await activeRun(store, environment.id), settings.templateVersion),
          })),
        ),
      };
    },
  },
});
