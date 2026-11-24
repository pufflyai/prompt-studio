import {
  defineCommand,
  definePage,
  defineView,
  type Localizable,
  l10n,
  params,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { refresh } from "./commands";
import { cancelDeployedWorkspace, getDeployed } from "./deployed-controller";
import { readTestOutput, readWorkspaceLogs } from "./deployed-machine-output";
import { projectDeployedMachineResource } from "./deployed-machine-resource";
import { deployedMachinePageRef, deployedPageRef } from "./lab-navigation";
import { type ControllerMachine, isTerminal, machinePath } from "./machines";
import { changed, deployedMachineActionsSlot, deployedMachineKind } from "./resources";

export const openDeployedMachine = defineCommand({
  id: "deployed.machine-open",
  title: l10n("cloud-workspaces.open-deployed-workspace", "Open deployed workspace"),
  cli: true,
  params: {
    machineId: params.text({ label: l10n("cloud-workspaces.machine-id", "Machine ID"), resolvedFrom: "resource" }),
  },
  async run(ctx, input) {
    const machineId = input.machineId ?? ctx.resource?.id;
    if (!machineId) throw new Error("Choose a deployed machine.");
    const machine = await getDeployed<ControllerMachine>(ctx.connections, machinePath(machineId));
    ctx.navigation.open({
      kind: "page",
      page: deployedMachinePageRef,
      resource: projectDeployedMachineResource(ctx, machine),
    });
    return { machineId: machine.id };
  },
});

export const stopDeployedWorkspaceWorker = defineCommand({
  id: "deployed.machine-stop-worker",
  title: l10n("cloud-workspaces.stop-deployed-workspace-in-background", "Stop deployed workspace in background"),
  automation: true,
  params: { machineId: params.text({ label: l10n("cloud-workspaces.machine-id", "Machine ID"), required: true }) },
  async run(ctx, { machineId }) {
    try {
      let machine = await cancelDeployedWorkspace(ctx.connections, machineId, ctx.signal);
      await ctx.events.emit(changed, {});
      while (!isTerminal(machine)) {
        const change = await getDeployed<{ workspace: ControllerMachine; changed: boolean }>(
          ctx.connections,
          `${machinePath(machineId)}/changes?after=${machine.change_cursor}&wait=3`,
          ctx.signal,
        );
        machine = change.workspace;
        if (change.changed) await ctx.events.emit(changed, {});
      }
      return { machineId, state: machine.state };
    } catch (error) {
      if (!ctx.signal.aborted) {
        await ctx.notify
          .action({
            title: "Could not stop workspace",
            body: error instanceof Error ? error.message : String(error),
            kind: "failed",
            target: { type: deployedMachineKind.id, id: machineId },
            dedupeKey: `deployed-stop-failed:${machineId}`,
          })
          .catch(() => {});
      }
      throw error;
    }
  },
});

export const stopDeployedWorkspace = defineCommand({
  id: "deployed.machine-stop",
  title: l10n("cloud-workspaces.stop-workspace", "Stop workspace"),
  mutating: true,
  menus: [{ slot: deployedMachineActionsSlot, icon: "square", when: { metadata: { canStop: true } } }],
  params: {
    confirmed: params.boolean({ label: l10n("cloud-workspaces.confirm-stop", "Confirm stop"), default: false }),
  },
  confirmation: {
    kind: "delete",
    confirmedParam: "confirmed",
    description: l10n(
      "cloud-workspaces.this-stops-the-workspace-and-any-app-or-test-running-inside-it",
      "This stops the workspace and any app or test running inside it.",
    ),
    buttonLabel: l10n("cloud-workspaces.stop-workspace", "Stop workspace"),
  },
  async run(ctx, { confirmed }) {
    const resource = ctx.resource;
    if (resource?.type !== deployedMachineKind.id) throw new Error("Choose a deployed workspace.");
    if (!confirmed) throw new Error("Confirm that you want to stop this workspace.");

    const run = await ctx.automation.enqueue({
      command: stopDeployedWorkspaceWorker.ref,
      input: { params: { machineId: resource.id } },
      key: `deployed-stop:${resource.id}:${crypto.randomUUID()}`,
    });
    return { machineId: resource.id, runId: run.id };
  },
});

export const deployedMachineLogs = defineCommand({
  id: "deployed.logs",
  title: l10n("cloud-workspaces.read-deployed-workspace-logs", "Read deployed workspace logs"),
  cli: true,
  params: { machineId: params.text({ label: l10n("cloud-workspaces.machine-id", "Machine ID"), required: true }) },
  async run(ctx, { machineId }) {
    const [testOutput, logs] = await Promise.all([
      readTestOutput(ctx.connections, machineId),
      readWorkspaceLogs(ctx.connections, machineId),
    ]);
    return { machineId, testOutput, logs };
  },
});

function logView(id: string, title: Localizable<string>, read: typeof readTestOutput, empty: string) {
  return defineView({
    id,
    title,
    icon: "file",
    body: {
      kind: "file",
      refreshEvents: [changed],
      async load(ctx, { renderer }) {
        const machineId = renderer.resource?.id;
        if (!machineId) return { emptyState: { title: "Choose a deployed machine" } };
        const content = await read(ctx.connections, machineId);
        if (!content) return { emptyState: { title: empty } };
        return { fileName: `${id}.log`, mimeType: "text/plain", content, editable: false, textRenderer: "monaco" };
      },
    },
  });
}

export const deployedTestOutputView = logView(
  "test-output",
  l10n("cloud-workspaces.test-output", "Test output"),
  readTestOutput,
  "No test output yet",
);
export const deployedWorkspaceLogsView = logView(
  "workspace-logs",
  l10n("cloud-workspaces.workspace-logs", "Workspace logs"),
  readWorkspaceLogs,
  "No logs yet",
);

const logTab = (label: Localizable<string>) => ({
  query() {
    return {
      label,
      menu: [
        {
          id: "logs",
          rows: [
            {
              id: "refresh",
              label: l10n("cloud-workspaces.refresh", "Refresh"),
              action: { kind: "command" as const, target: { command: refresh.ref } },
            },
          ],
        },
      ],
    };
  },
});

export const deployedMachinePage = definePage({
  id: "deployed-machine",
  title: l10n("cloud-workspaces.deployed-workspace", "Deployed workspace"),
  icon: "bot",
  path: "pocketcoder-deployed-machine",
  mode: workbenchModes.project,
  parent: deployedPageRef,
  resource: { kinds: [deployedMachineKind.ref] },
  main: { kind: "panels", landing: "output" },
  slots: [
    {
      id: "output",
      region: "main",
      order: 0,
      tab: logTab(l10n("cloud-workspaces.test-output", "Test output")),
      item: { kind: "view", view: deployedTestOutputView.ref, presence: "open" },
    },
    {
      id: "logs",
      region: "main",
      order: 1,
      tab: logTab(l10n("cloud-workspaces.workspace-logs", "Workspace logs")),
      item: { kind: "view", view: deployedWorkspaceLogsView.ref, presence: "open" },
    },
  ],
});
