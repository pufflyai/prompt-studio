import { describe, expect, it } from "bun:test";
import { findWorkspaceByRef } from "./find-workspace-by-ref";

describe("findWorkspaceByRef", () => {
  it("finds a workspace by shorthand or id", async () => {
    const workspaces = [
      { id: "ws-1", workspace_shorthand: "PS-1_A1" },
      { id: "ws-2", workspace_shorthand: "PS-1_A2" },
    ];

    const ctx = {
      projectId: "proj-1",
      client: {
        workspaces: {
          list: async () => workspaces,
        },
      },
    } as never;

    const byShorthand = await findWorkspaceByRef(ctx, { workspaceId: "PS-1_A2" });
    const byId = await findWorkspaceByRef(ctx, { workspaceId: "ws-1" });

    expect(byShorthand?.id).toBe("ws-2");
    expect(byId?.workspace_shorthand).toBe("PS-1_A1");
  });

  it("reuses the workspace object already present on hook context", async () => {
    const workspace = {
      id: "ws-1",
      workspace_shorthand: "PS-1_A1",
      ticket_shorthand: "PS-1",
      attempt_status_name: "review-ready",
    } as unknown as NonNullable<Awaited<ReturnType<typeof findWorkspaceByRef>>>;

    const ctx = {
      projectId: "proj-1",
      workspace,
      client: {
        workspaces: {
          list: async () => {
            throw new Error("should not list workspaces");
          },
        },
      },
    } as never;

    const resolved = await findWorkspaceByRef(ctx, { workspaceId: "PS-1_A1" });

    expect(resolved === workspace).toBe(true);
  });
});
