import type { WebviewCommandsExecuteParams, WebviewEditingSessionParams } from "pstdio-api-contracts/extension-kernel";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { WorkbenchCore } from "../../core";

export type EditingExecutor = (input: WebviewCommandsExecuteParams, signal?: AbortSignal) => Promise<unknown>;
export type CommandEditingOpen = Extract<WebviewEditingSessionParams, { operation: "open-command" }>;
export interface EditingOwner {
  projectId: string;
  extensionId: string;
  events: HostEventPublisher;
}
export interface CommandEditingMember {
  id: string;
  events: HostEventPublisher;
  execute: EditingExecutor;
  workbench: WorkbenchCore;
}
export const editingFailure = (code: string) => Object.assign(new Error(code), { code });
export const assertEditingCommandOwner = (extensionId: string, commandId: string) => {
  if (!commandId.startsWith(`${extensionId}.command.`)) throw editingFailure("editing_command_not_owner");
};

/** Optional reads and accepted commands share actual-child admission. Cancellation never releases it early. */
export const createEditingCommandQueue = () => {
  let tail = Promise.resolve();
  return <T>(run: () => Promise<T>, signal?: AbortSignal) => {
    const result = tail.then(() => {
      signal?.throwIfAborted();
      return run();
    });
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
};
