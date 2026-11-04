import { expect, test } from "bun:test";
import { viewDataEvents } from "@pstdio/sdk/extensions";
import { getWriter } from "@/lib/sync/collections";
import { publishExtensionEvent } from "./extension-webview-broadcast";
import { publishResourceRemoval } from "./resource-removal-feed";
import { subscribeResourceViewDataEvents } from "./resource-view-data-events";
import {
  emptyDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "./workbench-extension-contributions";

test("linked resource views refresh on owner data, availability, and removals without reacting to lifecycle events", async () => {
  const events: unknown[] = [];
  const dispose = subscribeResourceViewDataEvents({
    projectId: () => "project",
    refreshEventIds: () => ["notes.changed"],
    publish: (event) => events.push(event),
  });
  publishExtensionEvent({ id: "notes.changed", projectId: "project" });
  publishExtensionEvent({ id: "notes.changed", projectId: "project" });
  await Promise.resolve();
  expect(events).toEqual([{ id: viewDataEvents.resourcesChanged.id, projectId: "project" }]);
  publishExtensionEvent({ id: "command.completed", projectId: "project" });
  await Promise.resolve();
  expect(events).toHaveLength(1);
  getWriter("workspaces")!.upsert({ id: "ws", project_id: "project" });
  publishResourceRemoval({ type: "note", id: "deleted", extensionId: "notes", projectId: "project" });
  setCachedDashboardExtensionMetadata("project", emptyDashboardExtensionMetadata);
  await Promise.resolve();
  expect(events).toHaveLength(2);
  dispose();
  publishExtensionEvent({ id: "notes.changed", projectId: "project" });
  await Promise.resolve();
  expect(events).toHaveLength(2);
});
