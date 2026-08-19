import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import type { FileRendererRefreshEnvelope } from "@pstdio/workbench";

export interface ExtensionCommandEvent {
  commandId: string;
  extensionId: string;
  outcome: CommandExecuteResponse["outcome"];
  tick: number;
}

const subscribers = new Set<(event: ExtensionCommandEvent) => void>();
export interface ExtensionRefreshEvent extends FileRendererRefreshEnvelope {
  id: string;
}

const eventSubscribers = new Set<(event: ExtensionRefreshEvent) => void>();
let tick = 0;

export const subscribeToExtensionCommandFeed = (listener: (event: ExtensionCommandEvent) => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};

export const subscribeToExtensionEventFeed = (listener: (event: ExtensionRefreshEvent) => void) => {
  eventSubscribers.add(listener);
  return () => {
    eventSubscribers.delete(listener);
  };
};

export const publishExtensionEvent = (event: ExtensionRefreshEvent) => {
  for (const listener of eventSubscribers) listener(event);
};

export const publishExtensionCommandEvent = (
  response: CommandExecuteResponse,
  envelope: FileRendererRefreshEnvelope = {},
) => {
  tick += 1;
  const event: ExtensionCommandEvent = {
    commandId: response.commandId,
    extensionId: response.extensionId,
    outcome: response.outcome,
    tick,
  };
  for (const listener of subscribers) listener(event);
  for (const eventId of new Set(response.eventIds ?? [])) publishExtensionEvent({ id: eventId, ...envelope });
};
