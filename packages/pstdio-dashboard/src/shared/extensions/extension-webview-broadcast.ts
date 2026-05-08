import type { CommandExecuteResponse } from "pstdio-api-contracts";

/**
 * Tiny pubsub the host uses to publish command-execution outcomes to anything that wants
 * to react. `useExecuteExtensionCommand` publishes on success; `ExtensionWebviewFrame`
 * subscribes and forwards the latest event into the guest's `propsStore` via the bridge.
 */
export interface ExtensionCommandEvent {
  commandId: string;
  extensionId: string;
  outcome: CommandExecuteResponse["outcome"];
  /** Monotonic counter so reactive guests can detect new events even on identical outcomes. */
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
