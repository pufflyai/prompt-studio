import { describe, expect, test } from "bun:test";
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
        outcome: { ok: true, status: "success" },
      },
      { projectId: "project-1" },
    );
    publishExtensionEventReset();
    expect(received).toEqual([
      { type: "changed", id: "notes.changed" },
      { type: "changed", id: "notes.changed" },
      { type: "reset" },
    ]);
    dispose();
    publishExtensionEvent({ id: "notes.changed", projectId: "project-1" });
    publishExtensionEventReset();
    expect(received).toHaveLength(3);
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
