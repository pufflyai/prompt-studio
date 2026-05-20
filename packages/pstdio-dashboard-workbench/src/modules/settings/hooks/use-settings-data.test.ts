import { describe, expect, test } from "bun:test";
import { toAgentConfigs, toProjectRepos, toSettingsProject } from "./use-settings-data";

describe("settings data mapping", () => {
  test("ignores soft-deleted projects", () => {
    expect(
      toSettingsProject([{ id: "project-1", name: "Deleted", deleted_at: "2026-05-20T00:00:00.000Z" }]),
    ).toBeUndefined();
  });

  test("ignores soft-deleted repo links and repos", () => {
    expect(
      toProjectRepos(
        [
          { id: "link-1", repo_id: "repo-1" },
          { id: "link-2", repo_id: "repo-2", deleted_at: "2026-05-20T00:00:00.000Z" },
          { id: "link-3", repo_id: "repo-3" },
        ],
        [
          { id: "repo-1", display_name: "Active", path: "/repo/active" },
          { id: "repo-2", display_name: "Deleted link", path: "/repo/deleted-link" },
          {
            id: "repo-3",
            display_name: "Deleted repo",
            path: "/repo/deleted-repo",
            deleted_at: "2026-05-20T00:00:00.000Z",
          },
        ],
      ),
    ).toEqual([{ id: "repo-1", name: "Active", path: "/repo/active" }]);
  });

  test("ignores soft-deleted agent configs", () => {
    expect(
      toAgentConfigs([
        { id: "agent-1", agent_id: "opencode", is_default: true },
        { id: "agent-2", agent_id: "claude", deleted_at: "2026-05-20T00:00:00.000Z" },
      ]),
    ).toEqual([{ id: "agent-1", agentId: "opencode", isDefault: true }]);
  });
});
