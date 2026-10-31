import type { CommandExecutionResult } from "@pstdio/sdk/api";
import type { FileRendererRefreshEnvelope } from "@pstdio/workbench";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { createRuntimeFeed, createRuntimeState } from "@/lib/sync/runtime-state";

export interface ExtensionCommandEvent {
  commandId: string;
  extensionId: string;
  outcome: CommandExecutionResult["outcome"];
  tick: number;
}

const commandFeed = createRuntimeFeed<ExtensionCommandEvent>();
export interface ExtensionRefreshEvent extends FileRendererRefreshEnvelope {
  id: string;
  projectId?: string;
}

/** Asks views to reload everything. A reset without a project, as after reconnecting, reaches every project. */
export interface ExtensionResetEvent {
  projectId?: string;
}

const eventFeed = createRuntimeFeed<ExtensionRefreshEvent>();
const resetFeed = createRuntimeFeed<ExtensionResetEvent>();
const commandTicks = createRuntimeState(() => ({ tick: 0 }));
export const subscribeToExtensionCommandFeed = commandFeed.subscribe;
export const subscribeToExtensionEventFeed = eventFeed.subscribe;
export const publishExtensionEvent = eventFeed.publish;
export const subscribeToExtensionEventReset = resetFeed.subscribe;
export const publishExtensionEventReset = resetFeed.publish;

export const publishExtensionCommandEvent = (
  response: CommandExecutionResult,
  envelope: Omit<ExtensionRefreshEvent, "id"> & { projectId: string | undefined },
  owner = getRuntimeCollections(),
) => {
  if (owner.isDisposed()) return;
  const state = commandTicks(owner);
  state.tick += 1;
  const event: ExtensionCommandEvent = {
    commandId: response.commandId,
    extensionId: response.extensionId,
    outcome: response.outcome,
    tick: state.tick,
  };
  commandFeed.publish(event, owner);
  for (const eventId of new Set(response.eventIds ?? [])) publishExtensionEvent({ id: eventId, ...envelope }, owner);
};
