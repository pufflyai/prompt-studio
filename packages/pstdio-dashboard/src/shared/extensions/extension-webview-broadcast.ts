import type { CommandExecuteResponse } from "@pstdio/sdk/api";

export interface ExtensionCommandEvent {
  commandId: string;
  extensionId: string;
  outcome: CommandExecuteResponse["outcome"];
  tick: number;
}

const subscribers = new Set<(event: ExtensionCommandEvent) => void>();
const eventSubscribers = new Set<(eventId: string) => void>();
let tick = 0;

export const subscribeToExtensionCommandFeed = (listener: (event: ExtensionCommandEvent) => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};

export const subscribeToExtensionEventFeed = (listener: (eventId: string) => void) => {
  eventSubscribers.add(listener);
  return () => {
    eventSubscribers.delete(listener);
  };
};

export const publishExtensionEvent = (eventId: string) => {
  for (const listener of eventSubscribers) listener(eventId);
};

export const publishExtensionCommandEvent = (response: CommandExecuteResponse) => {
  tick += 1;
  const event: ExtensionCommandEvent = {
    commandId: response.commandId,
    extensionId: response.extensionId,
    outcome: response.outcome,
    tick,
  };
  for (const listener of subscribers) listener(event);
  for (const eventId of new Set(response.eventIds ?? [])) publishExtensionEvent(eventId);
};
