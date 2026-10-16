import { afterEach, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createSidenavModule } from "../sidenav/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionBubbleModule } from "./bubble/module";
import { createSessionsModule } from "./module";

afterEach(() => {
  for (const table of ["sessions", "workspaces", "workspace_sessions"] as const) getWriter(table)?.truncateAndWrite([]);
});
const setup = () => {
  const workbench = createWorkbench();
  for (const module of [
    createSidenavModule(),
    createWorkspacesModule(),
    createSessionBubbleModule(),
    createSessionsModule(),
  ])
    workbench.registerModule(module);
  selectDashboardProject(workbench, { id: "project", name: "Project" });
  return workbench;
};
const anchor = { type: "drawing", id: "drawing", extensionId: "example", projectId: "project" };
const session = (id: string, activity: string) => ({
  id,
  project_id: "project",
  title: id,
  archived: false,
  deleted_at: null,
  status: "completed",
  last_request_ended: activity,
  created_at: "2026-10-16T08:00:00Z",
  updated_at: "2026-10-16T08:00:00Z",
  anchors_json: [anchor],
});

test("sessions contribute recent-first relationships for arbitrary anchored resource kinds", () => {
  const workbench = setup();
  getWriter("sessions")?.truncateAndWrite([
    session("older", "2026-10-16T09:00:00Z"),
    session("recent", "2026-10-16T10:00:00Z"),
  ]);
  const related = workbench.resources.listRelatedResources(anchor);
  expect(related.map((entry) => entry.resource.id)).toEqual(["recent", "older"]);
  expect(related.every((entry) => entry.target?.kind === "panel")).toBe(true);
  expect(workbench.resources.listRelatedResources({ ...anchor, extensionId: "other" })).toEqual([]);
  expect(workbench.resources.listRelatedResources({ ...anchor, projectId: "other" })).toEqual([]);
});

test("workspace membership contributes sessions without requiring a duplicated resource link", () => {
  const workbench = setup();
  getWriter("sessions")?.truncateAndWrite([session("session", "2026-10-16T10:00:00Z")]);
  getWriter("workspaces")?.truncateAndWrite([
    { id: "workspace", project_id: "project", name: "Workspace", archived: false, root_path: "/repo" },
  ]);
  getWriter("workspace_sessions")?.truncateAndWrite([
    { id: "membership", workspace_id: "workspace", session_id: "session" },
  ]);
  const related = workbench.resources.listRelatedResources({
    type: "workspace",
    id: "workspace",
    extensionId: "pstdio",
    projectId: "project",
  });
  expect(related.map((entry) => entry.resource.id)).toEqual(["session"]);
});
