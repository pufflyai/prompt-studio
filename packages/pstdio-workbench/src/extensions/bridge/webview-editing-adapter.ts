import type { WebviewEditingSessionParams } from "pstdio-api-contracts/extension-kernel";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { WorkbenchCore, WorkbenchPanelInstance } from "../../core";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import { isWorkbenchRetiring, registerWorkbenchRequiredWork } from "../../core/workbench-required-work";
import { settingsLeaveGuard } from "../../react/settings/settings-leave-guard";
import { createCommandEditingSessions } from "./command-editing-sessions";
import type { EditingExecutor } from "./command-editing-types";
import { createLegacyEditingSessions } from "./webview-editing-session";

const createSessions = (workbench: WorkbenchCore) => {
  const retiring = () => isWorkbenchRetiring(workbench);
  const legacy = createLegacyEditingSessions(retiring);
  const commands = createCommandEditingSessions(workbench, getWorkbenchQueries(workbench), retiring);
  registerWorkbenchRequiredWork(workbench, async () => {
    const results = await Promise.allSettled([legacy.dispose(), commands.dispose()]);
    const errors = results.filter((result) => result.status === "rejected").map((result) => result.reason);
    if (errors.length) throw new AggregateError(errors, "Structured editing could not finish");
  });
  return { legacy, commands };
};
const sessions = new WeakMap<WorkbenchCore, ReturnType<typeof createSessions>>();

/** A shortcut must not overtake this project's already accepted semantic edits. */
export const prepareWorkbenchEditingCommand = (workbench: WorkbenchCore, commandId: string) =>
  sessions.get(workbench)?.commands.flushCommand(workbench.pages.store.getState().projectId, commandId);

export const createWorkbenchEditingSessionAdapter = (input: {
  workbench: WorkbenchCore;
  extensionId?: string;
  projectId?: string;
  hostEvents?: HostEventPublisher;
  placement?: WorkbenchPanelInstance;
}) => {
  const { workbench, extensionId, projectId, hostEvents } = input;
  if (!extensionId || !projectId || !hostEvents) return;
  let registry = sessions.get(workbench);
  if (!registry) {
    registry = createSessions(workbench);
    sessions.set(workbench, registry);
  }
  const owner = { extensionId, projectId, events: hostEvents };
  const settings = input.placement?.resource?.type === "workbench-settings" ? settingsLeaveGuard(workbench) : undefined;
  const legacy = registry.legacy.forOwner({ ...owner, settings, title: input.placement?.resource?.label });
  const commands = registry.commands;
  return {
    request(request: WebviewEditingSessionParams, execute: EditingExecutor) {
      if (
        request.operation === "open-command" ||
        request.operation === "execute" ||
        commands.has(owner, request.sessionId)
      )
        return commands.request(owner, request, execute);
      return legacy.request(request, execute);
    },
  };
};
