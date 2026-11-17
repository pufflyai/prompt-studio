import { expect, test } from "bun:test";
import { getRuntimeCollections, getWriter } from "@/lib/sync/collections";
import { subscribeCoreViewDataEvents } from "./core-view-data-events";
import { subscribeToExtensionEventFeed } from "./extension-webview-broadcast";
import { publishResourceAnchorChange } from "./resource-anchor-feed";

test("project metadata changes publish their exact project and changed fields", async () => {
  const writer = getWriter("projects")!;
  writer.upsert({ id: "home-project", name: "Before" });
  const events: import("./extension-webview-broadcast").ExtensionRefreshEvent[] = [];
  const stop = subscribeCoreViewDataEvents((event) => events.push(event));
  try {
    writer.upsert({ id: "home-project", name: "Renamed" });
    await Promise.resolve();
    expect(events).toMatchObject([
      {
        id: "view.projects.changed",
        projectId: "home-project",
        resourceIds: ["home-project"],
        changedFields: ["name"],
      },
    ]);
  } finally {
    stop();
    writer.remove("home-project");
  }
});

test("queued view events retain their runtime when the active connection changes before flush", async () => {
  const runtime = globalThis as { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const original = runtime.__PSTDIO_CONFIG__;
  const firstEvents: unknown[] = [];
  const secondEvents: unknown[] = [];
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: "http://queued-events-a" };
  const first = getRuntimeCollections();
  const unsubscribeFirst = subscribeToExtensionEventFeed((event) => firstEvents.push(event));
  const dispose = subscribeCoreViewDataEvents();
  first.getWriter("workspaces")!.upsert({ id: "same", project_id: "shared" });
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: "http://queued-events-b" };
  const second = getRuntimeCollections();
  const unsubscribeSecond = subscribeToExtensionEventFeed((event) => secondEvents.push(event));
  try {
    await Promise.resolve();
    expect(firstEvents).toMatchObject([{ id: "view.workspaces.changed", projectId: "shared" }]);
    expect(secondEvents).toEqual([]);
  } finally {
    dispose();
    unsubscribeFirst();
    unsubscribeSecond();
    await first.dispose();
    await second.dispose();
    runtime.__PSTDIO_CONFIG__ = original;
  }
});

test("committed anchor changes refresh owner views once per project and stop after disposal", async () => {
  const events: { id: string; projectId?: string }[] = [];
  const dispose = subscribeCoreViewDataEvents((event) => events.push(event));
  for (let index = 0; index < 3; index++)
    publishResourceAnchorChange({ id: String(index), projectId: "project", operation: "add", items: [] });
  await Promise.resolve();
  expect(events).toMatchObject([{ id: "view.resource-anchors.changed", projectId: "project" }]);
  dispose();
  publishResourceAnchorChange({ id: "removed", projectId: "project", operation: "remove", items: [] });
  await Promise.resolve();
  expect(events).toHaveLength(1);
});

test("view events coalesce by project and dependency, including old workspace owners", async () => {
  getWriter("workspaces")!.truncateAndWrite([{ id: "w", project_id: "a" }]);
  getWriter("sessions")!.truncateAndWrite([{ id: "s", project_id: "a" }]);
  const events: { id: string; projectId?: string }[] = [];
  const dispose = subscribeCoreViewDataEvents((event) => events.push(event));
  for (let i = 0; i < 1000; i++) getWriter("sessions")!.upsert({ id: "s", project_id: "b" });
  getWriter("workspaces")!.upsert({ id: "w", project_id: "b" });
  getWriter("workspaces")!.remove("w");
  getWriter("files")!.upsert({ id: "f", project_id: "c" });
  getWriter("notifications")!.upsert({ id: "n", project_id: "c" });
  await Promise.resolve();
  expect(events).toMatchObject([
    { id: "view.sessions.changed", projectId: "a" },
    { id: "view.sessions.changed", projectId: "b" },
    { id: "view.workspaces.changed", projectId: "a" },
    { id: "view.workspaces.changed", projectId: "b" },
  ]);
  getWriter("sessions")!.upsert({ id: "s", project_id: "c" });
  dispose();
  await Promise.resolve();
  expect(events).toHaveLength(4);
});

test("saved view and default changes refresh custom collection views once per project", async () => {
  const events: { id: string; projectId?: string }[] = [];
  const dispose = subscribeCoreViewDataEvents((event) => events.push(event));
  getWriter("board_views")!.upsert({ id: "view", project_id: "views-project" });
  getWriter("board_default_views")!.upsert({ id: "default", project_id: "views-project" });
  await Promise.resolve();
  expect(events).toMatchObject([{ id: "view.board-views.changed", projectId: "views-project" }]);
  dispose();
  getWriter("board_views")!.remove("view");
  await Promise.resolve();
  expect(events).toHaveLength(1);
});

test("native refresh identity retains row IDs, changed fields and list membership", async () => {
  const owner = getRuntimeCollections();
  const writer = owner.getWriter("sessions")!;
  writer.upsert({ id: "scoped-session", project_id: "scope-a", status: "idle", name: "Original" });
  const events: import("./extension-webview-broadcast").ExtensionRefreshEvent[] = [];
  const stop = subscribeCoreViewDataEvents((event) => events.push(event));
  try {
    writer.upsert({ id: "scoped-session", project_id: "scope-a", status: "idle", name: "New" });
    await Promise.resolve();
    expect(events[0]).toMatchObject({ projectId: "scope-a", resourceIds: ["scoped-session"], changedFields: ["name"] });
    events.length = 0;
    writer.remove("scoped-session");
    await Promise.resolve();
    expect(events[0]).toMatchObject({ projectId: "scope-a", resourceIds: ["scoped-session"], membership: true });
  } finally {
    stop();
    writer.remove("scoped-session");
  }
});

test("coalescing preserves the association between each resource and its changed fields", async () => {
  const { matchesQueryDependency } = await import("@pstdio/sdk/extensions");
  const writer = getWriter("sessions")!;
  writer.upsert({ id: "field-one", project_id: "fields", name: "One", status: "idle" });
  writer.upsert({ id: "field-two", project_id: "fields", name: "Two", status: "idle" });
  const events: import("./extension-webview-broadcast").ExtensionRefreshEvent[] = [];
  const stop = subscribeCoreViewDataEvents((event) => events.push(event));
  try {
    writer.upsert({ id: "field-one", project_id: "fields", name: "Renamed", status: "idle" });
    writer.upsert({ id: "field-two", project_id: "fields", name: "Two", status: "running" });
    await Promise.resolve();
    expect(events).toHaveLength(1);
    expect(matchesQueryDependency(events[0], { resourceId: "field-one", fields: ["status"] })).toBe(false);
    expect(matchesQueryDependency(events[0], { resourceId: "field-two", fields: ["status"] })).toBe(true);
  } finally {
    stop();
    writer.remove("field-one");
    writer.remove("field-two");
  }
});
