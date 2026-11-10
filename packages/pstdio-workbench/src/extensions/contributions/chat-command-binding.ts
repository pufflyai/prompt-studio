import type { WorkbenchPanelRenderInput } from "../../core";
import {
  type ExecuteWorkbenchExtensionCommandInput,
  executeWorkbenchExtensionCommand,
} from "../host/workbench-extension-command";
import type { RegisterWorkbenchExtensionContributionsInput } from "../host/workbench-extension-host-types";
import { captureRequiredChatWork } from "./chat-required-work";

export const createChatCommandBinding = (
  input: RegisterWorkbenchExtensionContributionsInput,
  render: WorkbenchPanelRenderInput,
  viewId: string,
  draftKey: string,
  replace: (params: Record<string, unknown>) => ExecuteWorkbenchExtensionCommandInput["onViewerReplace"],
) => {
  const resource = render.instance.resource;
  const renderer = {
    rendererId: viewId,
    projectId: input.projectId,
    resource,
    pageParams: render.instance.pageContext?.params,
    modeId: input.workbench.modes.getActiveModeId(),
    invocation: { placement: "visible" },
  };
  const slot = { id: viewId, kind: "renderer" as const, context: { projectId: input.projectId, rendererId: viewId } };
  const run = (commandId: string, params: Record<string, unknown>, signal?: AbortSignal) =>
    executeWorkbenchExtensionCommand(input, commandId, {
      params: { renderer, draftKey, ...params },
      resource,
      slot,
      signal,
      placement: render.instance.placementIdentity,
      onViewerReplace: replace(params),
    });
  const required = captureRequiredChatWork(render.workbench);
  return {
    renderer,
    slot,
    run,
    captureRequired: required.capture,
    required: (commandId: string, params: Record<string, unknown>) => required.run(() => run(commandId, params)),
  };
};
