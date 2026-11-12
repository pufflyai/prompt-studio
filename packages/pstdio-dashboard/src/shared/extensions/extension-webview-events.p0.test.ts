import { describe, expect, test } from "bun:test";
import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import {
  publishExtensionCommandEvent,
  publishExtensionEvent,
  publishExtensionEventReset,
} from "./extension-webview-broadcast";
import { subscribeWebviewExtensionEvents } from "./extension-webview-events";

describe("webview extension invalidations", () => {
  test("delivers only matching project events and releases both subscriptions", () => {
    const host = createHostEventPublisher();
    const received: unknown[] = [];
    host.bind((message) => received.push(message.payload));
    const dispose = subscribeWebviewExtensionEvents(host, "project-1");
    publishExtensionEvent({ id: "notes.changed", projectId: "project-2" });
    publishExtensionEvent({ id: "notes.changed" });
    expect(received).toEqual([]);
    publishExtensionEvent({ id: "notes.changed", projectId: "project-1" });
    publishExtensionCommandEvent(
      {
        commandId: "notes.save",
        extensionId: "notes",
        eventIds: ["notes.changed"],
        outcome: { ok: true, status: "success", value: undefined },
      },
      { projectId: "project-1" },
    );
    publishExtensionEventReset({});
    expect(received).toEqual([
      { type: "changed", id: "notes.changed", projectId: "project-1" },
      { type: "changed", id: "notes.changed", projectId: "project-1" },
      { type: "reset" },
    ]);
    dispose();
    publishExtensionEvent({ id: "notes.changed", projectId: "project-1" });
    publishExtensionEventReset({});
    expect(received).toHaveLength(3);
  });

  test("resets only the views of the project whose storage changed, and every view after reconnecting", () => {
    const host = createHostEventPublisher();
    const received: unknown[] = [];
    host.bind((message) => received.push(message.payload));
    const dispose = subscribeWebviewExtensionEvents(host, "project-1");
    publishExtensionEventReset({ projectId: "project-2" });
    expect(received).toEqual([]);
    publishExtensionEventReset({ projectId: "project-1" });
    publishExtensionEventReset({});
    expect(received).toEqual([{ type: "reset", projectId: "project-1" }, { type: "reset" }]);
    dispose();
  });

  test("keeps project changes out of global views", () => {
    const host = createHostEventPublisher();
    const received: unknown[] = [];
    host.bind((message) => received.push(message.payload));
    const dispose = subscribeWebviewExtensionEvents(host, undefined);
    publishExtensionEvent({ id: "notes.changed", projectId: "project-1" });
    publishExtensionEvent({ id: "settings.changed" });
    expect(received).toEqual([{ type: "changed", id: "settings.changed" }]);
    dispose();
  });
});

test("one renamed-owner reset refreshes old and current typed guests once", () => {
  const publisher = createHostEventPublisher();
  const listeners = new Set<(payload: unknown) => void>();
  publisher.bind((message) => {
    for (const listener of listeners) listener(message.payload);
  });
  const host: GuestHost = {
    extensionId: "example.consumer",
    call: async () => {
      throw new Error("No request expected");
    },
    onEvent: (_scope, listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const guest = createWebviewClient<Record<never, never>>(host);
  let oldCalls = 0;
  let currentCalls = 0;
  const old = guest.events.subscribe(
    { kind: "event", extensionId: "pstdio.pstdio-planner", id: "changed" },
    () => oldCalls++,
  );
  const current = guest.events.subscribe(
    { kind: "event", extensionId: "pstdio.planner", id: "changed" },
    () => currentCalls++,
  );
  const stop = subscribeWebviewExtensionEvents(publisher, "project-1");
  publishExtensionEventReset({ projectId: "project-2", extensionId: "pstdio.planner" });
  expect([oldCalls, currentCalls]).toEqual([0, 0]);
  publishExtensionEventReset({ projectId: "project-1", extensionId: "pstdio.planner" });
  expect([oldCalls, currentCalls]).toEqual([1, 1]);
  old();
  current();
  stop();
});
