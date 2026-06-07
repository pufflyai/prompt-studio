import { describe, expect, test } from "bun:test";
import { buildDashboardProjectsFromRows } from "./project-data";

const rows = {
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
  projectRepos: [{ id: "project-repo-1", project_id: "project-1", repo_id: "repo-1" }],
  repos: [{ id: "repo-1", path: "/repo/prompt-studio" }],
};

describe("dashboard project data selectors", () => {
  test("maps synced project rows into selectable workbench project resources", () => {
    const projects = buildDashboardProjectsFromRows(rows);

    expect(projects.map((project) => project.id)).toEqual(["project-2", "project-1"]);
    expect(projects[1]).toMatchObject({
      id: "project-1",
      name: "Prompt Studio",
      repoPath: "/repo/prompt-studio",
      resource: {
        kind: "project",
        id: "project-1",
        uri: "dashboard-workbench://project/project-1",
        label: "Prompt Studio",
        icon: "folder-root",
        metadata: { favoriteScope: { scope: "project", projectId: "project-1" } },
      },
    });
  });
});
