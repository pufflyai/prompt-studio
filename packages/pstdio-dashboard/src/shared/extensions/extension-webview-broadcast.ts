import type { CommandExecuteResponse } from "@pstdio/sdk/api";

export interface ExtensionCommandEvent {
  commandId: string;
  extensionId: string;
  outcome: CommandExecuteResponse["outcome"];
  tick: number;
}

const subscribers = new Set<(event: ExtensionCommandEvent) => void>();
let tick = 0;

export const subscribeToExtensionCommandFeed = (listener: (event: ExtensionCommandEvent) => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
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
};
