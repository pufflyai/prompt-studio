import { describe, expect, test } from "bun:test";
import { workspaceIdForStatusFrom } from "./workspace-status-helpers";

describe("workspace status helpers", () => {
  test("uses an explicit workspace id without resolving shorthand", async () => {
    const workspaceId = await workspaceIdForStatusFrom({
      params: { workspaceId: " workspace-1 " },
      process: {
        run: async () => {
          throw new Error("process should not run");
        },
      },
      workspaces: {
        getByShorthand: async () => {
          throw new Error("workspace lookup should not run");
        },
      },
    });

    expect(workspaceId).toBe("workspace-1");
  });

  test("resolves workspace shorthand from the current workspace branch", async () => {
    const workspaceId = await workspaceIdForStatusFrom({
      params: {},
      repo: { path: "/repo" },
      process: {
        run: async (input) => {
          expect(input).toEqual({
            command: ["git", "symbolic-ref", "--short", "HEAD"],
            cwd: "/repo",
          });
          return { exitCode: 0, stdout: "workspace/PS-1_A1\n" };
        },
      },
      workspaces: {
        getByShorthand: async (shorthand) => {
          expect(shorthand).toBe("PS-1_A1");
          return { id: "workspace-1" };
        },
      },
    });

    expect(workspaceId).toBe("workspace-1");
  });
});
