import { describe, expect, test } from "bun:test";
import type { DashboardRows } from "@/shared/sync/dashboard-rows";
import { createRecentProjectResources } from "./recent-project-resources";

const emptyRows: DashboardRows = {
  files: [],
  projectRepos: [],
  repos: [],
  sessions: [],
  workspaceSessions: [],
  workspaces: [],
};

const sessionRow = (id: string, title: string, updatedAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  status: "completed",
  project_id: "project-1",
  updated_at: updatedAt,
  ...extra,
});

const rowsWith = (sessions: Record<string, unknown>[]): DashboardRows => ({
  ...emptyRows,
  sessions: sessions as DashboardRows["sessions"],
});

describe("recent project resources", () => {
  test("orders resources by most recently updated", () => {
    const rows = rowsWith([
      sessionRow("older", "Older session", "2026-06-10T10:00:00.000Z"),
      sessionRow("newest", "Newest session", "2026-06-14T10:00:00.000Z"),
      sessionRow("middle", "Middle session", "2026-06-12T10:00:00.000Z"),
    ]);

    expect(createRecentProjectResources(rows, "project-1").map((resource) => resource.id)).toEqual([
      "newest",
      "middle",
      "older",
    ]);
  });

  test("describes each resource with its kind label and icon", () => {
    const rows = rowsWith([sessionRow("s1", "Weekly report", "2026-06-14T10:00:00.000Z")]);

    expect(createRecentProjectResources(rows, "project-1")[0]).toMatchObject({
      id: "s1",
      title: "Weekly report",
      kindLabel: "Session",
      icon: "MessageCircle",
    });
  });

  test("leaves out resources from other projects", () => {
    const rows = rowsWith([
      sessionRow("mine", "Mine", "2026-06-14T10:00:00.000Z"),
      sessionRow("other", "Other", "2026-06-15T10:00:00.000Z", { project_id: "project-2" }),
    ]);

    expect(createRecentProjectResources(rows, "project-1").map((resource) => resource.id)).toEqual(["mine"]);
  });

  test("leaves out archived and deleted resources", () => {
    const rows = rowsWith([
      sessionRow("kept", "Kept", "2026-06-14T10:00:00.000Z"),
      sessionRow("archived", "Archived", "2026-06-15T10:00:00.000Z", { archived: true }),
      sessionRow("deleted", "Deleted", "2026-06-16T10:00:00.000Z", { deleted_at: "2026-06-16T11:00:00.000Z" }),
    ]);

    expect(createRecentProjectResources(rows, "project-1").map((resource) => resource.id)).toEqual(["kept"]);
  });

  test("keeps only the requested number of resources", () => {
    const rows = rowsWith([
      sessionRow("a", "A", "2026-06-14T10:00:00.000Z"),
      sessionRow("b", "B", "2026-06-13T10:00:00.000Z"),
      sessionRow("c", "C", "2026-06-12T10:00:00.000Z"),
    ]);

    expect(createRecentProjectResources(rows, "project-1", 2).map((resource) => resource.id)).toEqual(["a", "b"]);
  });
});
