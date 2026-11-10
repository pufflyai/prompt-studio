import { describe, expect, it } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import {
  subscribeToExtensionEventFeed,
  subscribeToExtensionEventReset,
} from "@/shared/extensions/extension-webview-broadcast";
import { subscribeToResourceRemovals } from "@/shared/extensions/resource-removal-feed";
import { createRuntimeCollections } from "./collections";
import { createDashboardSyncWriterProvider, parseSyncDeleteEvent } from "./sync-client";

it("delivers resource events only to subscribers of the originating runtime", async () => {
  const first = createRuntimeCollections();
  const second = createRuntimeCollections();
  const received: unknown[] = [];
  const unsubscribe = subscribeToResourceRemovals((resource) => received.push(resource), first);
  const resource = { type: "note", id: "same", extensionId: "notes", projectId: "shared" };
  createDashboardSyncWriterProvider(second).getWriter("resource_events")!.upsert({ id: "event", resource });
  expect(received).toEqual([]);
  createDashboardSyncWriterProvider(first).getWriter("resource_events")!.upsert({ id: "event", resource });
  expect(received).toEqual([resource]);
  unsubscribe();
  await first.dispose();
  await second.dispose();
});

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

it("delivers committed anchor changes to views of both endpoints", async () => {
  const { subscribeToResourceAnchorChanges } = await import("@/shared/extensions/resource-anchor-feed");
  const events: unknown[] = [];
  const unsubscribe = subscribeToResourceAnchorChanges((event) => events.push(event));
  const event = {
    id: "link-event",
    projectId: "project",
    operation: "add",
    items: [{ source: { type: "note", id: "one" }, target: { type: "slide", id: "two" } }],
  };
  try {
    createDashboardSyncWriterProvider().getWriter("resource_anchor_events")?.upsert(event);
    expect(events).toEqual([event]);
  } finally {
    unsubscribe();
  }
});

it("refreshes the changed project's views after a committed storage change without extension-specific listeners", async () => {
  const collections = createRuntimeCollections();
  const resets: unknown[] = [];
  const stop = subscribeToExtensionEventReset((reset) => resets.push(reset), collections);
  try {
    createDashboardSyncWriterProvider(collections)
      .getWriter("extension_events")!
      .upsert({ id: "committed", eventId: "pstdio.event.storage-changed", projectId: "workbench" });
    expect(resets).toEqual([{ projectId: "workbench" }]);
  } finally {
    stop();
    await collections.dispose();
  }
});

it("preserves safe scoped invalidation metadata from another client without forwarding its payload", () => {
  const events: unknown[] = [];
  const stop = subscribeToExtensionEventFeed((event) => events.push(event));
  try {
    createDashboardSyncWriterProvider()
      .getWriter("extension_events")
      ?.upsert({
        id: "notification",
        eventId: "notes.changed",
        projectId: "project",
        resourceIds: ["note"],
        changes: [{ resourceId: "note", changedFields: ["title"] }],
        payload: { privateDocument: "secret" },
      });
    expect(events).toEqual([
      {
        id: "notes.changed",
        projectId: "project",
        resourceIds: ["note"],
        changes: [{ resourceId: "note", changedFields: ["title"] }],
      },
    ]);
  } finally {
    stop();
  }
});

it("retains storage extension and record scope in the reset contract without forwarding values", async () => {
  const collections = createRuntimeCollections();
  const resets: unknown[] = [];
  const stop = subscribeToExtensionEventReset((event) => resets.push(event), collections);
  try {
    createDashboardSyncWriterProvider(collections)
      .getWriter("extension_events")!
      .upsert({
        id: "storage",
        eventId: "pstdio.event.storage-changed",
        projectId: "project",
        extensionId: "marmalade",
        recordIds: ["presentation"],
        payload: { document: "private" },
      });
    expect(resets).toEqual([{ projectId: "project", extensionId: "marmalade", recordIds: ["presentation"] }]);
  } finally {
    stop();
    await collections.dispose();
  }
});

it("a synced presentation reset performs zero full-document or unrelated-extension reads", async () => {
  const collections = createRuntimeCollections();
  const queries = createScopedQueryClient(
    { runtimeId: "storage", projectId: "project", extensionId: "marmalade" },
    {
      subscribe: (invalidate) =>
        subscribeToExtensionEventReset((event) => invalidate({ ...event, type: "reset" }), collections),
    },
  );
  const counts = { presentation: 0, document: 0, notes: 0 };
  const stops = Object.keys(counts).map((key) => {
    const id = key as keyof typeof counts;
    return queries
      .forScope({ extensionId: id === "notes" ? "notes" : "marmalade" })
      .query({
        id,
        dependency: { recordId: id },
        read: () => ++counts[id],
      })
      .subscribe(() => {});
  });
  try {
    await Bun.sleep(0);
    createDashboardSyncWriterProvider(collections)
      .getWriter("extension_events")!
      .upsert({
        id: "storage",
        eventId: "pstdio.event.storage-changed",
        projectId: "project",
        extensionId: "marmalade",
        recordIds: ["presentation"],
      });
    await Bun.sleep(0);
    expect(counts).toEqual({ presentation: 2, document: 1, notes: 1 });
  } finally {
    for (const stop of stops) stop();
    queries.dispose();
    await collections.dispose();
  }
});
