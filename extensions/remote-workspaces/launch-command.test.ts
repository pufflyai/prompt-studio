import { describe, expect, test } from "bun:test";
import extension from "./extension";

const launch = extension.commands![0]!;

describe("PocketCoder launch", () => {
  test("creates a workspace from a template and starts its remote agent", async () => {
    const workspaces: unknown[] = [];
    const sessions: unknown[] = [];
    const result = await launch.run(
      {
        extensionId: "pstdio.remote-workspaces",
        projectId: "project-1",
        workspaces: {
          async create(input: unknown) {
            workspaces.push(input);
            return { id: "workspace-1", workspace_shorthand: "REMOTE-1", provider_state: "ready" };
          },
        },
        sessions: {
          async create(input: unknown) {
            sessions.push(input);
            return { id: "session-1" };
          },
        },
      } as never,
      { template: "pi-harness", prompt: "Implement the ticket" },
    );
    expect(workspaces).toEqual([
      {
        project_id: "project-1",
        shorthand_base: "remote",
        provider_id: "pstdio.remote-workspaces.workspace-type.remote",
        params: { template: "pi-harness" },
      },
    ]);
    expect(sessions).toEqual([
      expect.objectContaining({
        prompt: "Implement the ticket",
        workspaceId: "workspace-1",
        harness: { harnessId: "pstdio.remote-workspaces.harness.remote-agent" },
      }),
    ]);
    expect(result).toEqual({ workspaceId: "workspace-1", sessionId: "session-1" });
  });

  test("does not start an agent when workspace provisioning failed", async () => {
    const sessions: unknown[] = [];
    await expect(
      launch.run(
        {
          extensionId: "pstdio.remote-workspaces",
          projectId: "project-1",
          workspaces: {
            async create() {
              return { id: "workspace-1", provider_state: "failed" };
            },
          },
          sessions: {
            async create(input: unknown) {
              sessions.push(input);
              return { id: "session-1" };
            },
          },
        } as never,
        { template: "missing", prompt: "Hello" },
      ),
    ).rejects.toThrow("did not become ready");
    expect(sessions).toHaveLength(0);
  });
});
