import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./setup";

describe("agents setup", () => {
  test("installs skills and plugins for opencode", async () => {
    const setupAgent = mock(async () => ({ agent_id: "opencode", is_default: true }));
    const installSkillsForAgent = mock(async () => ["create-ticket"]);
    const installPluginsForAgent = mock(async () => ["pstdio-session-bridge.js"]);
    const log = mock();

    const handler = createHandler({
      cwd: () => "/repo",
      setupAgent,
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      installSkillsForAgent,
      installPluginsForAgent,
      log,
    });

    await handler({ "agent-id": "opencode", "global-skills": false, "global-plugins": false } as never);

    expect(setupAgent).toHaveBeenCalledWith("opencode");
    expect(installSkillsForAgent).toHaveBeenCalledWith({
      root: "/repo",
      agentId: "opencode",
      baseUrl: "http://localhost:19840",
      projectId: "proj-1",
      global: false,
    });
    expect(installPluginsForAgent).toHaveBeenCalledWith({
      root: "/repo",
      agentId: "opencode",
      global: false,
    });
    expect(log).toHaveBeenCalledWith('Agent "opencode" configured (default).');
    expect(log).toHaveBeenCalledWith("Installed 1 skill(s): create-ticket");
    expect(log).toHaveBeenCalledWith("Installed 1 plugin artifact(s): pstdio-session-bridge.js");
  });

  test("skips skill installation without project config but still installs plugins", async () => {
    const installSkillsForAgent = mock(async () => []);
    const installPluginsForAgent = mock(async () => ["pstdio-session-bridge.js"]);
    const log = mock();

    const handler = createHandler({
      cwd: () => "/repo",
      setupAgent: async () => ({ agent_id: "opencode", is_default: false }),
      findGitRoot: () => "/repo",
      readConfig: () => null,
      installSkillsForAgent,
      installPluginsForAgent,
      log,
    });

    await handler({ "agent-id": "opencode", "global-skills": false, "global-plugins": false } as never);

    expect(installSkillsForAgent).not.toHaveBeenCalled();
    expect(installPluginsForAgent).toHaveBeenCalledWith({ root: "/repo", agentId: "opencode", global: false });
    expect(log).toHaveBeenCalledWith("No project configured — skipping skill installation.");
    expect(log).not.toHaveBeenCalledWith("All skills already installed.");
  });

  test("supports global plugin install outside git repositories", async () => {
    const installPluginsForAgent = mock(async () => ["pstdio-session-bridge.js"]);

    const handler = createHandler({
      cwd: () => "/cwd",
      setupAgent: async () => ({ agent_id: "opencode", is_default: false }),
      findGitRoot: () => null,
      readConfig: () => null,
      installSkillsForAgent: async () => [],
      installPluginsForAgent,
      log: mock(),
    });

    await handler({ "agent-id": "opencode", "global-skills": false, "global-plugins": true } as never);

    expect(installPluginsForAgent).toHaveBeenCalledWith({
      root: "/cwd",
      agentId: "opencode",
      global: true,
    });
  });

  test("throws for unknown agents", async () => {
    const handler = createHandler({
      cwd: () => "/cwd",
      setupAgent: async () => ({ agent_id: "opencode", is_default: false }),
      findGitRoot: () => "/cwd",
      readConfig: () => ({ project_id: "p1" }),
      installSkillsForAgent: async () => [],
      installPluginsForAgent: async () => [],
      log: mock(),
    });

    await expect(
      handler({ "agent-id": "unknown", "global-skills": false, "global-plugins": false } as never),
    ).rejects.toThrow("Unknown agent: unknown");
  });
});
