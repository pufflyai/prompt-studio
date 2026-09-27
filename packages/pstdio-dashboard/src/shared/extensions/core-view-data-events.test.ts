import { expect, test } from "bun:test";
import { getWriter } from "@/lib/sync/collections";
import { subscribeCoreViewDataEvents } from "./core-view-data-events";

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
