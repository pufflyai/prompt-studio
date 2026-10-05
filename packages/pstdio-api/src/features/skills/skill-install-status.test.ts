import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getSkillInstallStatus } from "./skill-install-status";

const tempDirs: string[] = [];

const tempRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "skill-status-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const writeInstalledSkill = (repoPath: string, name: string, content: string) => {
  const dir = join(repoPath, ".claude/skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), content);
};

const deps = (path: string) =>
  ({
    workspaceService: { getDefault: async () => ({ root_path: path }) },
    harnessRegistry: {
      list: async () => [
        {
          id: "pstdio.harness-claude-code.harness.claude-code",
          extensionId: "pstdio.harness-claude-code",
          skills: { dir: ".claude/skills", globalDir: ".claude/skills" },
        },
      ],
    },
  }) as never;

describe("getSkillInstallStatus", () => {
  test("reports each agent that has a copy of the skill and the copy's version", async () => {
    const repo = tempRepo();
    writeInstalledSkill(repo, "create-ticket", "---\nmetadata:\n  version: 1.2.0\n---\n");

    const status = await getSkillInstallStatus(deps(repo), { projectId: "p1", name: "create-ticket" });

    expect(status.installed_agents).toEqual(["pstdio.harness-claude-code.harness.claude-code"]);
    expect(status.agent_installations).toEqual([
      {
        agent_id: "pstdio.harness-claude-code.harness.claude-code",
        agent_name: "claude-code",
        installed_version: "1.2.0",
      },
    ]);
  });

  test("reports no version for an unversioned copy", async () => {
    const repo = tempRepo();
    writeInstalledSkill(repo, "create-ticket", "# Body\n");

    const status = await getSkillInstallStatus(deps(repo), { projectId: "p1", name: "create-ticket" });

    expect(status.agent_installations[0]).toMatchObject({ installed_version: null });
  });

  test("reports no agents when no agent has a copy", async () => {
    const status = await getSkillInstallStatus(deps(tempRepo()), { projectId: "p1", name: "create-ticket" });

    expect(status).toEqual({ installed_agents: [], agent_installations: [] });
  });
});
