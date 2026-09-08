import { describe, expect, test } from "bun:test";
import type { GuestHost } from "./guest-host";
import { createWebviewClient } from "./webview-client";

describe("webview change subscriptions", () => {
  test("matches owned and external events, reconciles on reconnect, and disposes", () => {
    const listeners = new Set<(payload: unknown) => void>();
    const host: GuestHost = {
      extensionId: "acme.notes",
      call: async () => {
        throw new Error("No request expected");
      },
      onEvent: (_scope, listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
    const client = createWebviewClient<Record<never, never>>(host);
    let changes = 0;
    const unsubscribe = client.events.subscribe({ kind: "event", id: "changed" }, () => changes++);
    const emit = (payload: unknown) => {
      for (const listener of listeners) listener(payload);
    };
    emit({ type: "changed", id: "other.notes.changed" });
    expect(changes).toBe(0);
    emit({ type: "changed", id: "acme.notes.changed" });
    expect(changes).toBe(1);
    emit({ type: "reset" });
    expect(changes).toBe(2);
    unsubscribe();
    emit({ type: "changed", id: "acme.notes.changed" });
    expect(changes).toBe(2);
    expect(listeners.size).toBe(0);

    const stop = client.events.subscribe("other.notes.changed", () => changes++);
    emit({ type: "changed", id: "other.notes.changed" });
    expect(changes).toBe(3);
    stop();
  });
});
