import { describe, expect, test } from "bun:test";
import type { RendererEventReference } from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./guest-host";
import { createWebviewClient } from "./webview-client";

describe("webview change subscriptions", () => {
  test.each([
    [{ kind: "event", id: "changed" }, "acme.notes.event.changed"],
    [{ kind: "event", extensionId: "other.notes", id: "changed" }, "other.notes.event.changed"],
    [{ kind: "event", extensionId: "pstdio", id: "workspace.provision" }, "workspace.provision"],
    [{ kind: "event", id: "command.completed:save" }, "command.completed:acme.notes.command.save"],
    [
      { kind: "event", extensionId: "other.notes", id: "command.failed:save" },
      "command.failed:other.notes.command.save",
    ],
    [{ kind: "event", extensionId: "pstdio", id: "command.completed:save" }, "command.completed:save"],
    ["other.notes.event.changed", "other.notes.event.changed"],
  ] satisfies Array<[RendererEventReference, string]>)("matches %j, resets, and disposes", (event, eventId) => {
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
    const unsubscribe = client.events.subscribe(event, () => changes++);
    const emit = (payload: unknown) => {
      for (const listener of listeners) listener(payload);
    };
    emit({ type: "changed", id: "other.notes.changed" });
    expect(changes).toBe(0);
    emit({ type: "changed", id: eventId });
    expect(changes).toBe(1);
    emit({ type: "reset" });
    expect(changes).toBe(2);
    unsubscribe();
    emit({ type: "changed", id: eventId });
    expect(changes).toBe(2);
    expect(listeners.size).toBe(0);

    const stop = client.events.subscribe("other.notes.changed", () => changes++);
    emit({ type: "changed", id: "other.notes.changed" });
    expect(changes).toBe(3);
    stop();
  });
});
