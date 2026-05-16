import { describe, expect, it } from "bun:test";
import type { ProjectListItem } from "../types";
import { filterProjects } from "./filter-projects";

const buildProject = (overrides: Partial<ProjectListItem>): ProjectListItem => ({
  id: "id",
  name: "Project",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  repoPath: null,
  ...overrides,
});

describe("filterProjects", () => {
  const projects = [
    buildProject({ id: "1", name: "Alpha", repoPath: "/code/alpha-service" }),
    buildProject({ id: "2", name: "Beta", repoPath: "/work/beta-app" }),
    buildProject({ id: "3", name: "Gamma", repoPath: null }),
  ];

  it("returns all projects when the query is empty or whitespace", () => {
    expect(filterProjects(projects, "")).toEqual(projects);
    expect(filterProjects(projects, "   ")).toEqual(projects);
  });

  it("matches against project name case-insensitively", () => {
    const result = filterProjects(projects, "BeTa");
    expect(result.map((project) => project.id)).toEqual(["2"]);
  });

  it("matches against repository path case-insensitively", () => {
    const result = filterProjects(projects, "alpha-service");
    expect(result.map((project) => project.id)).toEqual(["1"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterProjects(projects, "delta")).toEqual([]);
  });

  it("ignores projects without a repo path when matching repo terms", () => {
    expect(filterProjects(projects, "/code")).toEqual([projects[0]]);
  });
});
