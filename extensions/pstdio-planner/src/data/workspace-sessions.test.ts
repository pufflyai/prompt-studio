import { describe, expect, test } from "bun:test";
import type { ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { loadLatestWorkspaceSessions } from "./workspace-sessions";

const makeWorkspace = (id: string, overrides: Partial<ExtensionWorkspace> = {}): ExtensionWorkspace => ({
  id,
  workspace_shorthand: "T-1_A1",
  ...overrides,
});

const makeSession = (id: string, status: string) => ({ id, title: id, status: status as "completed" });

const sessionsApi = (byWorkspace: Record<string, Array<ReturnType<typeof makeSession>>>, calls: string[] = []) => ({
  listByWorkspace: async (workspaceId: string) => {
    calls.push(workspaceId);
    return byWorkspace[workspaceId] ?? [];
  },
});

describe("loadLatestWorkspaceSessions", () => {
  test("selects the last session of each linked workspace", async () => {
    const lookup = await loadLatestWorkspaceSessions(
      sessionsApi({
        "workspace-1": [makeSession("session-old", "completed"), makeSession("session-new", "awaiting_input")],
        "workspace-2": [makeSession("session-other", "failed")],
      }),
      [makeWorkspace("workspace-1"), makeWorkspace("workspace-2", { workspace_shorthand: "T-1_A2" })],
    );

    expect(lookup.get("workspace-1")).toEqual({ id: "session-new", status: "awaiting_input" });
    expect(lookup.get("workspace-2")).toEqual({ id: "session-other", status: "failed" });
  });

  test("omits workspaces without sessions", async () => {
    const lookup = await loadLatestWorkspaceSessions(sessionsApi({}), [makeWorkspace("workspace-1")]);

    expect(lookup.has("workspace-1")).toBe(false);
  });

  test("only queries workspaces linked to a ticket", async () => {
    const calls: string[] = [];
    await loadLatestWorkspaceSessions(sessionsApi({}, calls), [
      makeWorkspace("workspace-1"),
      makeWorkspace("workspace-unlinked", { workspace_shorthand: "scratch" }),
    ]);

    expect(calls).toEqual(["workspace-1"]);
  });

  test("queries each workspace once", async () => {
    const calls: string[] = [];
    await loadLatestWorkspaceSessions(sessionsApi({}, calls), [
      makeWorkspace("workspace-1"),
      makeWorkspace("workspace-1"),
    ]);

    expect(calls).toEqual(["workspace-1"]);
  });
});
