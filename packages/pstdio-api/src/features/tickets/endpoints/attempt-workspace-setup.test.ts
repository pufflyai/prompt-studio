import { describe, expect, it, mock } from "bun:test";
import { assertEventDispatchSucceeded, resolveAgentId } from "./attempt-workspace-setup";

describe("assertEventDispatchSucceeded", () => {
  it("throws when an extension lifecycle hook reports diagnostics", () => {
    expect(() =>
      assertEventDispatchSucceeded("kernel.postWorktreeCreate", {
        delivered: 0,
        diagnostics: [{ code: "hook_failed", message: "Hook failed", severity: "warning" }],
      }),
    ).toThrow("HOOK kernel.postWorktreeCreate FAILED\nHook failed");
  });
});

describe("resolveAgentId", () => {
  it("returns null when requested agent is not enabled for the project", async () => {
    const deps = {
      agentRegistry: {
        get: mock(() => null),
      },
      projectService: {
        get: mock(async () => ({ selected_agents: '["opencode"]' })),
      },
      agentConfigService: {
        list: mock(async () => [
          {
            id: "cfg-1",
            agent_id: "opencode",
            is_default: true,
            config: "{}",
            created_at: "2026-04-24T00:00:00.000Z",
            updated_at: "2026-04-24T00:00:00.000Z",
          },
        ]),
      },
    };

    const resolved = await resolveAgentId(deps, "claude-code", "project-1");

    expect(resolved).toBeNull();
  });

  it("falls back to the project's default enabled agent", async () => {
    const deps = {
      agentRegistry: {
        get: mock(() => null),
      },
      projectService: {
        get: mock(async () => ({ selected_agents: '["opencode"]' })),
      },
      agentConfigService: {
        list: mock(async () => [
          {
            id: "cfg-1",
            agent_id: "claude-code",
            is_default: true,
            config: "{}",
            created_at: "2026-04-24T00:00:00.000Z",
            updated_at: "2026-04-24T00:00:00.000Z",
          },
          {
            id: "cfg-2",
            agent_id: "opencode",
            is_default: false,
            config: "{}",
            created_at: "2026-04-24T00:00:00.000Z",
            updated_at: "2026-04-24T00:00:00.000Z",
          },
        ]),
      },
    };

    const resolved = await resolveAgentId(deps, undefined, "project-1");

    expect(resolved).toBe("opencode");
  });
});
