import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./setup";

describe("agents setup", () => {
  test("installs skills for opencode", async () => {
    const setupAgent = mock(async () => ({
      id: "1",
      agent_id: "opencode",
      is_default: true,
      config: "{}",
      created_at: "t",
      updated_at: "t",
    }));
    const installSkillsForAgent = mock(async () => ["create-ticket"]);
    const log = mock();

    const handler = createHandler({
      cwd: () => "/repo",
      setupAgent,
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      installSkillsForAgent,
      log,
    });

    await handler({ "agent-id": "opencode", "global-skills": false } as never);

    expect(setupAgent).toHaveBeenCalledWith("opencode");
    expect(installSkillsForAgent).toHaveBeenCalledWith({
      root: "/repo",
      agentId: "opencode",
      projectId: "proj-1",
      global: false,
    });
    expect(log).toHaveBeenCalledWith('Agent "opencode" configured (default).');
    expect(log).toHaveBeenCalledWith("Installed 1 skill(s): create-ticket");
  });

  test("skips skill installation without project config", async () => {
    const installSkillsForAgent = mock(async () => []);
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
      readConfig: () => null,
      installSkillsForAgent,
      log,
    });

    await handler({ "agent-id": "opencode", "global-skills": false } as never);

    expect(installSkillsForAgent).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("No project configured — skipping skill installation.");
    expect(log).not.toHaveBeenCalledWith("All skills already installed.");
  });

  test("supports global skill install outside git repositories", async () => {
    const installSkillsForAgent = mock(async () => ["create-ticket"]);

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
      readConfig: () => null,
      installSkillsForAgent,
      log: mock(),
    });

    await handler({ "agent-id": "opencode", "global-skills": true } as never);

    expect(installSkillsForAgent).toHaveBeenCalledWith({
      root: "/cwd",
      agentId: "opencode",
      projectId: undefined,
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
      readConfig: () => ({ project_id: "p1" }),
      installSkillsForAgent: async () => [],
      log: mock(),
    });

    await expect(handler({ "agent-id": "unknown", "global-skills": false } as never)).rejects.toThrow(
      "Unknown agent: unknown",
    );
  });
});
