import { describe, expect, test } from "bun:test";
import { resolveSessionCwd } from "./resolve-session-cwd";

const makeDeps = (workspace: Record<string, unknown>) =>
  ({
    workspaceService: { get: async () => workspace },
    repoService: { listByProject: async () => [{ id: "repo-1", path: "/repo" }] },
  }) as never;

describe("resolveSessionCwd", () => {
  test("does not fall back to the project repository for a remote workspace", async () => {
    const cwd = await resolveSessionCwd(
      makeDeps({
        id: "ws-remote",
        project_id: "project-1",
        provider_state: "ready",
        execution_kind: "remote",
        worktree_path: null,
      }),
      "project-1",
      "ws-remote",
    );

    expect(cwd).toBeUndefined();
  });

  test("does not fall back when provider creation failed", async () => {
    const cwd = await resolveSessionCwd(
      makeDeps({
        id: "ws-failed",
        project_id: "project-1",
        provider_state: "failed",
        execution_kind: "local",
        worktree_path: null,
      }),
      "project-1",
      "ws-failed",
    );

    expect(cwd).toBeUndefined();
  });
});
