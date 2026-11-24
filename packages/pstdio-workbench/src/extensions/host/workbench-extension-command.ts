import type { CommandExecuteRequest, CommandExecutionResult, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { NavigationTarget, PlacementIdentity } from "@pstdio/sdk/extensions";
import type {
  ResourceRef,
  WorkbenchCommandExecutionContext,
  WorkbenchModuleContext,
  WorkbenchPanelRegion,
} from "../../core";
import { resolveCommandResourceParams } from "../../core/registries/commands/command-resource-params";
import type { WorkbenchOperations } from "../../core/registries/mutations/operations";
import { isPageContent } from "../../core/registries/pages/page-main";
import { applyCommandClipboard } from "./command-clipboard";
import { unwrapCommandValue } from "./command-response";
import { toWorkbenchNavigationTarget } from "./extension-navigation-target";
import { checkExactGateLaunch, readAndSettleGateLaunch } from "./planner-gate-launch-check";
import { remoteWorkspaceLaunchCommand, runRemoteWorkspaceLaunch } from "./remote-workspace-launch";
import { plannerGateLaunch, plannerGateLaunchCheck, runWorkbenchCommandOperation } from "./workbench-command-operation";
import { type CreateOperationFeedback, runCreateOperation } from "./workbench-create-operation";
import { runResourceMutation } from "./workbench-resource-mutation";
export interface WorkbenchExtensionCommandContext {
  metadata?: Pick<WorkbenchExtensionMetadata, "commands">;
  createCommandIds?: ReadonlySet<string>;
  operations?: WorkbenchOperations;
  executeCommand(commandId: string, body: CommandExecuteRequest, signal?: AbortSignal): Promise<unknown> | unknown;
  prepareCommandArgs?(
    commandId: string,
    args: unknown,
    context?: WorkbenchCommandExecutionContext,
    onArgsChange?: (args: unknown) => void,
  ): Promise<unknown> | unknown;
  projectId: string;
  workbench: WorkbenchModuleContext;
}
export interface ExecuteWorkbenchExtensionCommandInput {
  onViewerReplace?(resource: ResourceRef): void;
  onAdmitted?(): void;
  createFeedback?: CreateOperationFeedback;
  removalVersion?: number;
  isViewerCurrent?(): boolean;
  placement?: PlacementIdentity;
  region?: WorkbenchPanelRegion;
  workspaceId?: string;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
  foreground?: true;
  params?: Record<string, unknown>;
  resource?: ResourceRef;
  slot?: CommandExecuteRequest["slot"];
}
export const createExtensionSlot = (input: {
  context?: Record<string, unknown>;
  id: string;
  kind: NonNullable<CommandExecuteRequest["slot"]>["kind"];
  projectId: string;
}) => ({
  id: input.id,
  kind: input.kind,
  context: { projectId: input.projectId, ...(input.context ?? {}) },
});
// Command callbacks do not receive private placement identity. A returned viewer
// page is a destination hint for captured Main; panels keep their binding. Core
// from/current-viewer checks still apply after this presentation-only adaptation.
const commandViewerTarget = (
  target: NavigationTarget,
  viewer: PlacementIdentity | undefined,
  pages: WorkbenchModuleContext["pages"],
) => {
  if (target.kind !== "viewer" || !target.page || !viewer) return target;
  if (viewer.kind === "page" && isPageContent(pages.getPage(viewer.pageId), viewer)) return target;
  const { page: _mainPage, ...panelTarget } = target;
  return panelTarget;
};
export const executeWorkbenchExtensionCommandResponse = async (
  context: Pick<WorkbenchExtensionCommandContext, "executeCommand" | "projectId" | "metadata"> & {
    workbench: Pick<WorkbenchModuleContext, "navigation" | "notifications" | "resources" | "viewers" | "pages"> &
      Partial<Pick<WorkbenchModuleContext, "commands">>;
  },
  commandId: string,
  input: ExecuteWorkbenchExtensionCommandInput = {},
) => {
  const resource = input.resource;
  const captured = context.workbench.viewers.captureContext(input.placement);
  const invocation = {
    ...captured,
    onViewerReplace: input.onViewerReplace,
    removalVersion: input.removalVersion ?? captured.removalVersion,
    isViewerCurrent: input.isViewerCurrent ?? captured.isViewerCurrent,
  };
  const reportNavigationError = context.workbench.notifications.captureActionError("Open command result");
  const pendingResponse = Promise.resolve(
    context.executeCommand(
      commandId,
      {
        projectId: context.projectId,
        ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
        ...(input.params ? { params: input.params } : {}),
        ...(resource ? { resource } : {}),
        ...(input.slot ? { slot: input.slot } : {}),
        source: "dashboard",
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
      input.signal,
    ),
  );
  const declaredCommand = context.metadata?.commands.find((candidate) => candidate.id === commandId);
  const command = declaredCommand ?? context.workbench.commands?.getCommand(commandId)?.command;
  // Start writing before awaiting the remote command, while the selecting gesture is active.
  const response = await (command?.copyResultToClipboard
    ? applyCommandClipboard({
        response: pendingResponse,
        mutating: declaredCommand?.mutating,
        signal: input.signal,
        isViewerCurrent: invocation.isViewerCurrent,
        reportError: context.workbench.notifications.captureActionError("Copy command result"),
      })
    : pendingResponse);
  const outcome = (response as Partial<CommandExecutionResult> | undefined)?.outcome;
  if (outcome?.status === "success" && !input.signal?.aborted) {
    for (const target of outcome.navigationRequests ?? []) {
      if (input.signal?.aborted) break;
      try {
        const navigationTarget = commandViewerTarget(target, captured.viewer, context.workbench.pages);
        await context.workbench.navigation.openTarget(
          toWorkbenchNavigationTarget(navigationTarget, { region: input.region }),
          {
            ...invocation,
            projectId: context.projectId,
          },
        );
      } catch (error) {
        reportNavigationError(error);
      }
    }
  }
  return response;
};
export const executeWorkbenchExtensionCommand = async (
  context: WorkbenchExtensionCommandContext,
  commandId: string,
  input: ExecuteWorkbenchExtensionCommandInput = {},
) => {
  const command = context.metadata?.commands.find((candidate) => candidate.id === commandId);
  const resolved = command
    ? { ...resolveCommandResourceParams(command.params, input.params, { resource: input.resource }), ...input.params }
    : input.params;
  const provided = command?.confirmation ? { ...resolved, [command.confirmation.confirmedParam]: true } : resolved;
  const hasGateCheck = context.metadata?.commands.some(
    (record) => record.id === plannerGateLaunchCheck && record.extensionId === "pstdio.planner",
  );
  const trackGate = hasGateCheck && command?.id === plannerGateLaunch && command.extensionId === "pstdio.planner";
  const params =
    trackGate && typeof provided?.ticket === "string"
      ? { ...provided, attemptId: provided.attemptId ?? crypto.randomUUID() }
      : provided;
  const send = async (signal?: AbortSignal, id = commandId, bodyParams = params) =>
    unwrapCommandValue(
      await executeWorkbenchExtensionCommandResponse(context, id, {
        ...input,
        params: bodyParams,
        signal: signal && input.signal ? AbortSignal.any([signal, input.signal]) : (signal ?? input.signal),
      }),
    );
  const operations = context.operations;
  if (operations && hasGateCheck && commandId === plannerGateLaunchCheck)
    return readAndSettleGateLaunch(operations, context.projectId, params?.ticket, send, (value) => value);
  if (operations && commandId === remoteWorkspaceLaunchCommand) {
    return runRemoteWorkspaceLaunch({
      commands: context.metadata?.commands ?? [],
      operations,
      projectId: context.projectId,
      params,
      execute: (id, values, signal) => send(signal, id, values),
    });
  }
  const create = context.createCommandIds?.has(commandId);
  const foreground = input.foreground || input.slot?.kind === "menu";
  if (operations && command?.mutating && !command.resourceMutation && !create && foreground)
    return runWorkbenchCommandOperation({
      operations,
      projectId: context.projectId,
      command,
      source: input.resource,
      params,
      onAdmitted: input.onAdmitted,
      check: trackGate
        ? checkExactGateLaunch(
            params,
            (args, signal) =>
              Promise.resolve(
                context.executeCommand(
                  plannerGateLaunchCheck,
                  { projectId: context.projectId, params: args, source: "dashboard" },
                  signal,
                ),
              ),
            unwrapCommandValue,
          )
        : undefined,
      write: send,
    });
  const persist =
    operations && command && create
      ? () => runCreateOperation(operations, context.projectId, command, resolved, send, input.createFeedback)
      : send;
  return command ? runResourceMutation(context, command, params, input, persist) : persist();
};
