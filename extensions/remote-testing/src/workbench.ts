import {
  type DataTableRendererRowActivationHandler,
  defineNavigationItem,
  definePage,
  defineView,
  viewDataEvents,
  workbenchModes,
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
import { activeRun, listEnvironments } from "./environments";
import { environmentValues, runValues } from "./run-rows";
import { checkRun, listRuns } from "./runs";
import { sessionResource } from "./session-link";

const refreshAction = { id: "refresh", label: "Refresh", icon: "refresh-cw", command: refresh.ref };

// Double-clicking a run opens the session that started it.
const openRunSession: DataTableRendererRowActivationHandler = (ctx, { row }) => {
  if (row.resource) ctx.navigation.open({ kind: "page", page: workbenchPages.session, resource: row.resource });
};

export const runsView = defineView({
  id: "runs",
  title: "Test runs",
  icon: "flask-conical",
  body: {
    kind: "dataTable",
    refreshEvents: [changed, viewDataEvents.sessionsChanged],
    emptyTitle: "No remote test runs yet",
    emptyDescription: "Agents start runs with pst pocketcoder.remote-testing run.",
    toolbarActions: [
      {
        id: "run-tests",
        label: "Run tests",
        icon: "flask-conical",
        presentation: "primary",
        command: run.ref,
        input: run.params,
      },
      {
        id: "run-prompt-studio",
        label: "Run Prompt Studio",
        icon: "play",
        command: runPromptStudio.ref,
        input: runPromptStudio.params,
      },
      refreshAction,
    ],
    columns: [
      { id: "status", label: "Status", groupable: true },
      { id: "command", label: "Command" },
      { id: "session", label: "Started by", groupable: true },
      { id: "environment", label: "Environment", groupable: true },
      { id: "started", label: "Started", type: "date" },
      { id: "duration", label: "Duration (s)", type: "number" },
      { id: "exitCode", label: "Exit code", type: "number" },
      { id: "log", label: "Log" },
    ],
    rowActions: [
      { id: "session", label: "Open session", icon: "messages-square", command: openSession.ref },
      { id: "cancel", label: "Cancel run", icon: "square", destructive: true, command: cancelRunCommand.ref },
    ],
    onRowActivate: openRunSession,
    defaultSorts: [{ attributeId: "started", direction: "desc" }],
    async query(ctx) {
      const records = await listRuns(ctx.storage);
      // Older runs may have been submitted before background collection was available.
      const deps = await runDeps(ctx).catch(() => null);
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
  title: "Test environments",
  icon: "server",
  body: {
    kind: "dataTable",
    refreshEvents: [changed],
    emptyTitle: "No test environments are running",
    emptyDescription: "A run starts an environment when it needs one and stops it when the run finishes.",
    toolbarActions: [
      {
        id: "start",
        label: "Start environment",
        icon: "plus",
        presentation: "primary",
        command: createEnvironmentCommand.ref,
      },
      { id: "stop-all", label: "Stop all", icon: "square", command: stopAllEnvironments.ref },
      refreshAction,
    ],
    columns: [
      { id: "environment", label: "Environment" },
      { id: "state", label: "State", groupable: true },
      { id: "activity", label: "Activity" },
      { id: "template", label: "Template", groupable: true },
      { id: "started", label: "Started", type: "date" },
      { id: "stopsAt", label: "Stops at", type: "date" },
    ],
    rowActions: [
      { id: "stop", label: "Stop environment", icon: "square", destructive: true, command: stopEnvironmentCommand.ref },
    ],
    async query(ctx) {
      const { api, settings, store } = await runDeps(ctx);
      return {
        rows: await Promise.all(
          (await listEnvironments(api, settings, ctx.projectId)).map(async (environment) => ({
            id: environment.id,
            values: environmentValues(environment, await activeRun(store, environment.id), settings.templateVersion),
          })),
        ),
      };
    },
  },
});

export const remoteTestsPage = definePage({
  id: "remote-tests",
  title: "Remote tests",
  icon: "flask-conical",
  path: "remote-tests",
  mode: workbenchModes.project,
  main: { kind: "panels", landing: "runs", empty: runsView.ref },
  slots: [
    {
      id: "runs",
      region: "main",
      tab: { query: () => ({ label: "Runs" }) },
      order: 1,
      item: { kind: "view", view: runsView.ref, presence: "open" },
    },
    {
      id: "environments",
      region: "main",
      tab: { query: () => ({ label: "Environments" }) },
      order: 2,
      item: { kind: "view", view: environmentsView.ref, presence: "open" },
    },
  ],
});

export const navigation = defineNavigationItem({
  id: "remote-tests",
  label: "Remote tests",
  icon: "flask-conical",
  owner: workbenchModes.project,
  slot: "content",
  action: { kind: "page", page: remoteTestsPage.ref },
});
