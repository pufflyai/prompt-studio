import { expect, test } from "bun:test";
import { getWriter } from "@/lib/sync/collections";
import { subscribeCoreViewDataEvents } from "./core-view-data-events";

test("view events coalesce by project and dependency, including old owners and removed repo links", async () => {
  getWriter("project_repos")!.truncateAndWrite([
    { id: "a", repo_id: "repo", project_id: "a" },
    { id: "b", repo_id: "repo", project_id: "b" },
  ]);
  getWriter("sessions")!.truncateAndWrite([{ id: "s", project_id: "a" }]);
  const events: { id: string; projectId?: string }[] = [];
  const dispose = subscribeCoreViewDataEvents((event) => events.push(event));
  for (let i = 0; i < 1000; i++) getWriter("sessions")!.upsert({ id: "s", project_id: "b" });
  getWriter("repos")!.upsert({ id: "repo" });
  getWriter("repos")!.remove("repo");
  getWriter("project_repos")!.remove("a");
  getWriter("files")!.upsert({ id: "f", project_id: "c" });
  getWriter("notifications")!.upsert({ id: "n", project_id: "c" });
  await Promise.resolve();
  expect(events).toEqual([
    { id: "view.sessions.changed", projectId: "a" },
    { id: "view.sessions.changed", projectId: "b" },
    { id: "view.repositories.changed", projectId: "a" },
    { id: "view.repositories.changed", projectId: "b" },
  ]);
  getWriter("sessions")!.upsert({ id: "s", project_id: "c" });
  dispose();
  await Promise.resolve();
  expect(events).toHaveLength(4);
});
