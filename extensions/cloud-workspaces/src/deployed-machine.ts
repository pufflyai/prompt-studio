import { defineCommand, definePage, defineView, params, workbenchModes } from "@pstdio/sdk/extensions";
import { refresh } from "./commands";
import { cancelDeployedWorkspace, getDeployed } from "./deployed-controller";
import { readTestOutput, readWorkspaceLogs } from "./deployed-machine-output";
import { deployedMachinePageRef, deployedPageRef } from "./lab-navigation";
import { type ControllerMachine, isTerminal, machinePath } from "./machines";
import { changed, deployedMachineActionsSlot, deployedMachineKind } from "./resources";

export const openDeployedMachine = defineCommand({
  id: "deployed.machine-open",
  title: "Open deployed workspace",
  cli: true,
  params: { machineId: params.text({ label: "Machine ID", resolvedFrom: "resource" }) },
  async run(ctx, input) {
    const machineId = input.machineId ?? ctx.resource?.id;
    if (!machineId) throw new Error("Choose a deployed machine.");
    const machine = await getDeployed<ControllerMachine>(ctx.connections, machinePath(machineId));
    ctx.navigation.open({
      kind: "page",
      page: deployedMachinePageRef,
      resource: {
        type: deployedMachineKind.id,
        extensionId: ctx.extensionId,
        projectId: ctx.projectId,
        id: machine.id,
        label: machine.external_id,
        icon: "bot",
      },
    });
    return { machineId: machine.id };
  },
});

export const stopDeployedWorkspaceWorker = defineCommand({
  id: "deployed.machine-stop-worker",
  title: "Stop deployed workspace in background",
  automation: true,
  params: { machineId: params.text({ label: "Machine ID", required: true }) },
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
  title: "Stop workspace",
  mutating: true,
  menus: [{ slot: deployedMachineActionsSlot, icon: "square", when: { metadata: { canStop: true } } }],
  params: { confirmed: params.boolean({ label: "Confirm stop", default: false }) },
  confirmation: {
    kind: "delete",
    confirmedParam: "confirmed",
    description: "This stops the workspace and any app or test running inside it.",
    buttonLabel: "Stop workspace",
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
  title: "Read deployed workspace logs",
  cli: true,
  params: { machineId: params.text({ label: "Machine ID", required: true }) },
  async run(ctx, { machineId }) {
    const [testOutput, logs] = await Promise.all([
      readTestOutput(ctx.connections, machineId),
      readWorkspaceLogs(ctx.connections, machineId),
    ]);
    return { machineId, testOutput, logs };
  },
});

function logView(id: string, title: string, read: typeof readTestOutput, empty: string) {
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

export const deployedTestOutputView = logView("test-output", "Test output", readTestOutput, "No test output yet");
export const deployedWorkspaceLogsView = logView("workspace-logs", "Workspace logs", readWorkspaceLogs, "No logs yet");

const logTab = (label: string) => ({
  query() {
    return {
      label,
      menu: [
        {
          id: "logs",
          rows: [
            { id: "refresh", label: "Refresh", action: { kind: "command" as const, target: { command: refresh.ref } } },
          ],
        },
      ],
    };
  },
});

export const deployedMachinePage = definePage({
  id: "deployed-machine",
  title: "Deployed workspace",
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
      tab: logTab("Test output"),
      item: { kind: "view", view: deployedTestOutputView.ref, presence: "open" },
    },
    {
      id: "logs",
      region: "main",
      order: 1,
      tab: logTab("Workspace logs"),
      item: { kind: "view", view: deployedWorkspaceLogsView.ref, presence: "open" },
    },
  ],
});
