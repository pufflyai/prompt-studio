import type { ResourceRef, WebviewCommandsExecuteParams } from "@pstdio/sdk/extensions";
import { UnresolvedSubmissionError } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { getWorkbenchOperations, operationSubject } from "../../core/registries/mutations/operations";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import { unwrapCommandValue } from "../host/command-response";
import { runTrackedCreate } from "../host/workbench-create-operation";

const commandPrefix = "pstdio.workspaces.command.";
const createCommand = `${commandPrefix}create`;

const interruptedCreation = {
  outcome: {
    ok: false,
    status: "error",
    code: "workspace_create_unconfirmed",
    reason:
      "Workspace creation could not be confirmed. Inspect Workspaces or recover the submission in System activity.",
  },
} as const;

const workspaceResource = (resource: ResourceRef | undefined, projectId: string, id: string): ResourceRef =>
  resource?.type === "workspace" && resource.id === id && (!resource.projectId || resource.projectId === projectId)
    ? { ...resource, projectId }
    : { type: "workspace", extensionId: "pstdio", id, projectId };

export const runWorkspaceWebviewMutation = async (input: {
  workbench: WorkbenchCore;
  projectId: string;
  resource?: ResourceRef;
  request: WebviewCommandsExecuteParams;
  signal?: AbortSignal;
  execute(signal?: AbortSignal): Promise<unknown>;
}) => {
  const { workbench, projectId, request } = input;
  const { commandId, params } = request;
  const write = async (operationSignal: AbortSignal) => {
    const signal = input.signal ? AbortSignal.any([operationSignal, input.signal]) : operationSignal;
    signal.throwIfAborted();
    const response = await input.execute(signal);
    unwrapCommandValue(response);
    return response;
  };
  if (commandId === createCommand) {
    const operations = getWorkbenchOperations(getWorkbenchQueries(workbench));
    const subject = operationSubject("create", projectId, createCommand);
    if (
      operations.getSnapshot().pending.some((entry) => entry.subjects.includes(subject) && entry.status !== "unknown")
    )
      throw new Error("Workspace creation is already in progress.");
    try {
      return await runTrackedCreate(
        operations,
        {
          projectId,
          subjects: [subject],
          title: "Create workspace",
          draft: { commandId, params },
          write,
        },
        (recovery) =>
          recovery.find(
            (entry) =>
              entry.projectId === projectId &&
              entry.status === "unknown" &&
              (entry.draft as { commandId?: string } | undefined)?.commandId === commandId,
          ),
      );
    } catch (error) {
      if (error instanceof UnresolvedSubmissionError) return interruptedCreation;
      throw error;
    }
  }

  const id = params?.id;
  if (typeof id === "string" && id) {
    const resource = workspaceResource(request.resource ?? input.resource, projectId, id);
    const name = params?.name;
    if (commandId === `${commandPrefix}rename` && typeof name === "string" && name.trim()) {
      return workbench.resources.preview.submit(resource, write, { label: name.trim() }, "Rename workspace");
    }
    if (commandId === `${commandPrefix}delete` && params?.confirmed === true) {
      return workbench.resources.preview.submit(resource, write, { removed: true }, "Delete workspace");
    }
  }
  return input.execute(input.signal);
};
