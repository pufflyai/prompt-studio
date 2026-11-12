import { apiLogger } from "../../lib/logger";
import type { EventBus } from "../sync/event-bus";

const sources = new WeakMap<EventBus, Map<string, Set<() => void>>>();

/** Control presentation is an optional exact-session hint, not a replicated row or replay-buffer entry. */
export const emitSessionCommandsChanged = (bus: EventBus, sessionId: string) => {
  for (const listener of [...(sources.get(bus)?.get(sessionId) ?? [])]) {
    try {
      listener();
    } catch (err) {
      apiLogger.warn({ err, event: "session.commands.observer_failed" }, "Session command observer failed");
    }
  }
};

export const observeSessionCommandsChanged = (bus: EventBus, sessionId: string, changed: () => void) => {
  let sessions = sources.get(bus);
  if (!sessions) {
    sessions = new Map();
    sources.set(bus, sessions);
  }
  let listeners = sessions.get(sessionId);
  if (!listeners) {
    listeners = new Set();
    sessions.set(sessionId, listeners);
  }
  const token = () => changed();
  listeners.add(token);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    listeners.delete(token);
    if (!listeners.size) sessions.delete(sessionId);
    if (!sessions.size && sources.get(bus) === sessions) sources.delete(bus);
  };
};
