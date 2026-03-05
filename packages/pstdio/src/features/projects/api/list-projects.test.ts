import { describe, expect, test } from "bun:test";
import { mockFetch } from "@/test-utils/mock-fetch";
import { listProjects } from "./list-projects";

describe("listProjects", () => {
  test("returns list of projects", async () => {
    const projects = [
      { id: "1", name: "Project A", created_at: "2026-01-15T00:00:00.000Z" },
      { id: "2", name: "Project B", created_at: "2026-02-20T00:00:00.000Z" },
    ];
    mockFetch(200, projects);

    const result = await listProjects("http://test:3000");

    expect(result).toEqual(projects);
  });

  test("returns empty array when no projects", async () => {
    mockFetch(200, []);

    const result = await listProjects("http://test:3000");

    expect(result).toEqual([]);
  });
});
