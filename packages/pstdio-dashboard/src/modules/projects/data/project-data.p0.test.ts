import { describe, expect, test } from "bun:test";
import { buildDashboardProjectsFromRows } from "./project-data";

const rows = {
  workspaces: [{ id: "home", project_id: "project-1", is_default: true, root_path: "/repo/prompt-studio" }],
  projects: [
    {
      id: "project-1",
      name: "Prompt Studio",
      created_at: "2026-05-20T08:00:00Z",
      updated_at: "2026-05-20T09:00:00Z",
      deleted_at: null,
    },
    {
      id: "project-2",
      name: "Datazine",
      created_at: "2026-05-21T08:00:00Z",
      updated_at: "2026-05-21T09:00:00Z",
      deleted_at: null,
    },
    {
      id: "project-deleted",
      name: "Deleted",
      created_at: "2026-05-22T08:00:00Z",
      updated_at: "2026-05-22T09:00:00Z",
      deleted_at: "2026-05-22T10:00:00Z",
    },
  ],
};
describe("dashboard project data selectors", () => {
  test("the project location belongs to this device's default workspace", () => {
    const foreign = { ...rows.workspaces[0], id: "foreign", root_path: "/other-device", device: { id: "other" } };
    const local = { ...rows.workspaces[0], root_path: null };
    const projects = buildDashboardProjectsFromRows({ ...rows, workspaces: [local, foreign] });
    expect(projects.find((project) => project.id === "project-1")?.folderPath).toBeNull();
  });

  test("maps synced project rows into selectable workbench project resources", () => {
    const projects = buildDashboardProjectsFromRows(rows);
    expect(projects.map((project) => project.id)).toEqual(["project-2", "project-1"]);
    expect(projects[1]).toMatchObject({
      id: "project-1",
      name: "Prompt Studio",
      folderPath: "/repo/prompt-studio",
      resource: {
        type: "project",
        id: "project-1",
        label: "Prompt Studio",
        icon: "folder-root",
        metadata: { favoriteScope: { scope: "project", projectId: "project-1" } },
      },
    });
  });
});
