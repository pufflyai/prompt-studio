import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./setup";

const harnessIds = {
  "claude-code": "pstdio.harness-claude-code.claude-code",
  opencode: "pstdio.harness-open-code.opencode",
};
const resolveHarnessId = async (id: string) => {
  const match = harnessIds[id as keyof typeof harnessIds];
  if (!match) throw new Error(`No installed harness found for agent: ${id}`);
  return match;
};

describe("agents setup", () => {
  test("installs skills for opencode", async () => {
    const installSkillsForAgent = mock(async () => ["create-ticket"]);
    const log = mock();

    const handler = createHandler({
      resolveHarnessId,
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      installSkillsForAgent,
      log,
    });

    await handler({ "agent-id": "opencode", "global-skills": false } as never);

    expect(installSkillsForAgent).toHaveBeenCalledWith({
      root: "/repo",
      agentId: "opencode",
      projectId: "proj-1",
      global: false,
    });
    expect(log).toHaveBeenCalledWith('Using harness "pstdio.harness-open-code.opencode".');
    expect(log).toHaveBeenCalledWith("Installed 1 skill(s): create-ticket");
  });

  test("skips skill installation without project config", async () => {
    const installSkillsForAgent = mock(async () => []);
    const log = mock();

    const handler = createHandler({
      resolveHarnessId,
      cwd: () => "/repo",
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
      resolveHarnessId,
      cwd: () => "/cwd",
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
      resolveHarnessId,
      cwd: () => "/cwd",
      findGitRoot: () => "/cwd",
      readConfig: () => ({ project_id: "p1" }),
      installSkillsForAgent: async () => [],
      log: mock(),
    });

    await expect(handler({ "agent-id": "unknown", "global-skills": false } as never)).rejects.toThrow(
      "No installed harness found for agent: unknown",
    );
  });
});
