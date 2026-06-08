import { describe, expect, test } from "bun:test";
import {
  attemptStatusMapQueryKey,
  plannerWorkspaceStatusDefinitionQueryKeys,
  projectAttemptStatusesQueryKey,
} from "@/shared/planner-workspace-statuses/query-keys";
import { buildAttemptStatusMap } from "./attempt-status-map";

describe("attempt status query keys", () => {
  test("does not reuse the project settings status key", () => {
    expect(attemptStatusMapQueryKey("project-1")).not.toEqual(projectAttemptStatusesQueryKey("project-1"));
  });

  test("invalidates every workspace status definition consumer", () => {
    expect(plannerWorkspaceStatusDefinitionQueryKeys("project-1")).toEqual([
      projectAttemptStatusesQueryKey("project-1"),
      attemptStatusMapQueryKey("project-1"),
    ]);
  });
});

describe("buildAttemptStatusMap", () => {
  test("returns map from rows", () => {
    const rows = [
      { id: "s1", name: "wip", color: "blue", project_id: "p1" },
      { id: "s2", name: "blocked", color: "red", project_id: "p1" },
    ];
    const map = buildAttemptStatusMap(rows);

    expect(map.size).toBe(2);
    expect(map.get("s1")).toEqual({ name: "wip", color: "blue", description: null });
    expect(map.get("s2")).toEqual({ name: "blocked", color: "red", description: null });
  });

  test("returns empty map for undefined", () => {
    const map = buildAttemptStatusMap(undefined);
    expect(map.size).toBe(0);
  });

  test("returns empty map for empty array", () => {
    const map = buildAttemptStatusMap([]);
    expect(map.size).toBe(0);
  });
});
