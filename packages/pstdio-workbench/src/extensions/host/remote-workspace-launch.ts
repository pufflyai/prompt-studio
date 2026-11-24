import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { classifyApiWrite } from "../../core/registries/mutations/operation-failures";
import { operationSubject, type WorkbenchOperations } from "../../core/registries/mutations/operations";
import { runTrackedCreate } from "./workbench-create-operation";

const commandPrefix = "pstdio.remote-workspaces.command";
export const remoteWorkspaceLaunchCommand = `${commandPrefix}.launch`;
const prepareCommand = `${commandPrefix}.prepare-launch-workspace`;
const sessionCommand = `${commandPrefix}.start-launch-session`;

interface LaunchDraft {
  commandId: string;
  params: Record<string, unknown>;
  stage: "workspace" | "session";
  workspace?: { id: string; shorthand?: string };
  sessionRejected?: boolean;
}

const recoverMessage = (value: unknown) => {
  const draft = value as LaunchDraft | undefined;
  const workspace = draft?.workspace;
  if (!draft || !workspace) return "PocketCoder launch could not be confirmed.";
  const name = workspace.shorthand ?? workspace.id;
  if (draft.stage === "workspace") return `Workspace ${name} was created and still needs attention.`;
  return draft.sessionRejected
    ? `Workspace ${name} was created. The session request was rejected.`
    : `Workspace ${name} was created. Session creation could not be confirmed.`;
};

const prepareReceipt = (value: unknown) => {
  const receipt = value as { workspaceId?: string; shorthand?: string; ready?: boolean } | undefined;
  if (typeof receipt?.workspaceId !== "string" || !receipt.workspaceId || typeof receipt.ready !== "boolean") {
    throw new SyntaxError("PocketCoder did not return the prepared workspace.");
  }
  return {
    workspace: {
      id: receipt.workspaceId,
      shorthand: typeof receipt.shorthand === "string" ? receipt.shorthand : undefined,
    },
    ready: receipt.ready,
  };
};

export const runRemoteWorkspaceLaunch = (input: {
  commands: WorkbenchExtensionMetadata["commands"];
  operations: WorkbenchOperations;
  projectId: string;
  params?: Record<string, unknown>;
  execute(commandId: string, params: Record<string, unknown>, signal: AbortSignal): Promise<unknown>;
}) => {
  const { commands, operations, projectId, execute } = input;
  const params = input.params ?? {};
  const { prompt, ...workspaceParams } = params;
  if (typeof prompt !== "string" || !prompt.trim()) throw new Error("Enter a prompt to launch a PocketCoder session.");
  const hasCommand = (id: string) => commands.some((command) => command.id === id);
  const staged = hasCommand(prepareCommand) && hasCommand(sessionCommand);
  const subject = operationSubject("create", projectId, remoteWorkspaceLaunchCommand);
  const draft: LaunchDraft = { commandId: remoteWorkspaceLaunchCommand, params, stage: "workspace" };
  const alreadyActive = operations
    .getSnapshot()
    .pending.some((entry) => entry.subjects.includes(subject) && entry.status !== "unknown");
  if (alreadyActive) throw new Error("A PocketCoder launch is already in progress for this project.");

  return runTrackedCreate(
    operations,
    {
      projectId,
      subjects: [subject],
      title: "Launch PocketCoder session",
      draft,
      classify: (error) => (draft.workspace ? "unknown" : classifyApiWrite(error)),
      async write(signal) {
        // Installed releases expose their supported stages through their existing command inventory.
        if (!staged) return execute(remoteWorkspaceLaunchCommand, params, signal);
        const prepared = prepareReceipt(await execute(prepareCommand, workspaceParams, signal));
        signal.throwIfAborted();
        draft.workspace = prepared.workspace;
        if (!prepared.ready) throw new Error("The PocketCoder workspace did not become ready.");

        draft.stage = "session";
        const result = (await execute(sessionCommand, { workspaceId: prepared.workspace.id, prompt }, signal).catch(
          (error: unknown) => {
            draft.sessionRejected = classifyApiWrite(error) === "rejected";
            throw error;
          },
        )) as { sessionId?: string } | undefined;
        if (typeof result?.sessionId !== "string" || !result.sessionId) {
          throw new SyntaxError("PocketCoder did not return the started session.");
        }
        return { workspaceId: prepared.workspace.id, sessionId: result.sessionId };
      },
    },
    (recovery) =>
      recovery.find(
        (entry) =>
          entry.status === "unknown" &&
          entry.projectId === projectId &&
          (entry.draft as LaunchDraft | undefined)?.commandId === remoteWorkspaceLaunchCommand,
      ),
    recoverMessage,
  );
};
