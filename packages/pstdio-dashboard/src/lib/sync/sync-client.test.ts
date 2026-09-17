import { describe, expect, it } from "bun:test";
import { subscribeToExtensionEventFeed } from "@/shared/extensions/extension-webview-broadcast";
import { subscribeToResourceRemovals } from "@/shared/extensions/resource-removal-feed";
import { createDashboardSyncWriterProvider, parseSyncDeleteEvent } from "./sync-client";

it("delivers resource removal facts without a command response", () => {
  const received: unknown[] = [];
  const unsubscribe = subscribeToResourceRemovals((resource) => received.push(resource));
  const resource = { type: "note", id: "one", extensionId: "notes", projectId: "project" };
  try {
    createDashboardSyncWriterProvider().getWriter("resource_events")?.upsert({ id: "event", resource });
    expect(received).toEqual([resource]);
  } finally {
    unsubscribe();
  }
});

describe("parseSyncDeleteEvent", () => {
  it("reads the deleted id from sync:delete payloads emitted by the API", () => {
    const event = parseSyncDeleteEvent(
      JSON.stringify({
        table: "projects",
        data: { id: "project-1" },
        seq: 42,
      }),
    );

    expect(event).toEqual({
      table: "projects",
      id: "project-1",
      seq: 42,
    });
  });
});

describe("createDashboardSyncWriterProvider", () => {
  it("publishes extension events delivered by another client", () => {
    const events: string[] = [];
    const unsubscribe = subscribeToExtensionEventFeed((event) => events.push(event.id));

    try {
      const writer = createDashboardSyncWriterProvider().getWriter("extension_events");
      writer?.upsert({
        id: "event-1",
        eventId: "pstdio-planner.tickets.changed",
        projectId: "project-1",
      });

      expect(events).toEqual(["pstdio-planner.tickets.changed"]);
    } finally {
      unsubscribe();
    }
  });
});
