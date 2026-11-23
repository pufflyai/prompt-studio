import { describe, expect, test } from "bun:test";
import extension, { prepareLaunchWorkspace, startLaunchSession } from "./extension";

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

test("prepares a correlated workspace and starts a session on that exact workspace", async () => {
  const workspaces: string[] = [];
  const sessions: unknown[] = [];
  const workspace = {
    id: "workspace-2",
    workspace_shorthand: "REMOTE-2",
    provider_id: "pstdio.remote-workspaces.workspace-type.remote",
    provider_state: "ready",
  };
  const context = {
    extensionId: "pstdio.remote-workspaces",
    projectId: "project-1",
    signal: new AbortController().signal,
    workspaces: {
      async create() {
        workspaces.push(workspace.id);
        return workspace;
      },
      async get(id: string) {
        return id === workspace.id ? workspace : null;
      },
    },
    sessions: {
      async create(input: unknown) {
        sessions.push(input);
        return { id: "session-2" };
      },
    },
  } as never;
  expect(await prepareLaunchWorkspace.run(context, { template: "pi-harness" })).toEqual({
    workspaceId: "workspace-2",
    shorthand: "REMOTE-2",
    ready: true,
  });
  expect(sessions).toEqual([]);
  expect(await startLaunchSession.run(context, { workspaceId: "workspace-2", prompt: "Continue" })).toEqual({
    sessionId: "session-2",
  });
  expect(workspaces).toEqual(["workspace-2"]);
  expect(sessions).toMatchObject([{ workspaceId: "workspace-2", prompt: "Continue" }]);
  await expect(startLaunchSession.run(context, { workspaceId: "unrelated", prompt: "Continue" })).rejects.toThrow(
    "PocketCoder workspace",
  );
  expect(sessions).toHaveLength(1);
});
