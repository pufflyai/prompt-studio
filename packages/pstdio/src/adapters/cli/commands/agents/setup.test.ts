import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./setup";

describe("agents setup", () => {
  test("installs plugin artifacts for opencode", async () => {
    const setupAgent = mock(async () => ({
      id: "1",
      agent_id: "opencode",
      is_default: true,
      config: "{}",
      created_at: "t",
      updated_at: "t",
    }));
    const installPluginsForAgent = mock(async () => ["pstdio-session-bridge.js"]);
    const log = mock();

    const handler = createHandler({
      cwd: () => "/repo",
      setupAgent,
      findGitRoot: () => "/repo",
      installPluginsForAgent,
      log,
    });

    await handler({ "agent-id": "opencode", "global-plugins": false } as never);

    expect(setupAgent).toHaveBeenCalledWith("opencode");
    expect(installPluginsForAgent).toHaveBeenCalledWith({
      root: "/repo",
      agentId: "opencode",
      global: false,
    });
    expect(log).toHaveBeenCalledWith('Agent "opencode" configured (default).');
    expect(log).toHaveBeenCalledWith("Installed 1 plugin artifact(s): pstdio-session-bridge.js");
  });

  test("installs plugins without project config", async () => {
    const installPluginsForAgent = mock(async () => ["pstdio-session-bridge.js"]);
    const log = mock();

    const handler = createHandler({
      cwd: () => "/repo",
      setupAgent: async () => ({
        id: "1",
        agent_id: "opencode",
        is_default: false,
        config: "{}",
        created_at: "t",
        updated_at: "t",
      }),
      findGitRoot: () => "/repo",
      installPluginsForAgent,
      log,
    });

    await handler({ "agent-id": "opencode", "global-plugins": false } as never);

    expect(installPluginsForAgent).toHaveBeenCalledWith({ root: "/repo", agentId: "opencode", global: false });
  });

  test("supports global plugin install outside git repositories", async () => {
    const installPluginsForAgent = mock(async () => ["pstdio-session-bridge.js"]);

    const handler = createHandler({
      cwd: () => "/cwd",
      setupAgent: async () => ({
        id: "1",
        agent_id: "opencode",
        is_default: false,
        config: "{}",
        created_at: "t",
        updated_at: "t",
      }),
      findGitRoot: () => null,
      installPluginsForAgent,
      log: mock(),
    });

    await handler({ "agent-id": "opencode", "global-plugins": true } as never);

    expect(installPluginsForAgent).toHaveBeenCalledWith({
      root: "/cwd",
      agentId: "opencode",
      global: true,
    });
  });

  test("throws for unknown agents", async () => {
    const handler = createHandler({
      cwd: () => "/cwd",
      setupAgent: async () => ({
        id: "1",
        agent_id: "opencode",
        is_default: false,
        config: "{}",
        created_at: "t",
        updated_at: "t",
      }),
      findGitRoot: () => "/cwd",
      installPluginsForAgent: async () => [],
      log: mock(),
    });

    await expect(handler({ "agent-id": "unknown", "global-plugins": false } as never)).rejects.toThrow(
      "Unknown agent: unknown",
    );
  });
});
