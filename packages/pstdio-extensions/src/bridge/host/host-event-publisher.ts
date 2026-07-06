import type { HostEventMessage } from "../contract";

/**
 * Host-side fan-in for events pushed into one guest webview. Capability
 * implementations `emit` while the frame owns the transport: events emitted
 * before the guest connection is up are buffered and flushed on `bind`.
 */
export interface HostEventPublisher {
  emit(message: HostEventMessage): void;
  bind(sink: (message: HostEventMessage) => void): void;
  onDisconnect(listener: () => void): () => void;
  /** Drop the current sink and return to buffering until the next bind. */
  unbind(): void;
}

export const createHostEventPublisher = (): HostEventPublisher => {
  let sink: ((message: HostEventMessage) => void) | null = null;
  const pending: HostEventMessage[] = [];
  const disconnectListeners = new Set<() => void>();

  return {
    emit(message) {
      if (sink) sink(message);
      else pending.push(message);
    },
    bind(next) {
      sink = next;
      while (pending.length > 0) next(pending.shift() as HostEventMessage);
    },
    onDisconnect(listener) {
      disconnectListeners.add(listener);
      return () => disconnectListeners.delete(listener);
    },
    unbind() {
      sink = null;
      for (const listener of disconnectListeners) listener();
    },
  };
};
