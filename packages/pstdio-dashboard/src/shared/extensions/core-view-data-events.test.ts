import { expect, test } from "bun:test";
import { getWriter } from "@/lib/sync/collections";
import { subscribeCoreViewDataEvents } from "./core-view-data-events";
import { publishResourceAnchorChange } from "./resource-anchor-feed";

test("committed anchor changes refresh owner views once per project and stop after disposal", async () => {
  const events: { id: string; projectId?: string }[] = [];
  const dispose = subscribeCoreViewDataEvents((event) => events.push(event));
  for (let index = 0; index < 3; index++)
    publishResourceAnchorChange({ id: String(index), projectId: "project", operation: "add", items: [] });
  await Promise.resolve();
  expect(events).toEqual([{ id: "view.resource-anchors.changed", projectId: "project" }]);
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
  expect(events).toEqual([
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
  expect(events).toEqual([{ id: "view.board-views.changed", projectId: "views-project" }]);
  dispose();
  getWriter("board_views")!.remove("view");
  await Promise.resolve();
  expect(events).toHaveLength(1);
});
