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

const writeInstalledSkill = (repoPath: string, name: string, version: string) => {
  const dir = join(repoPath, ".claude/skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\nmetadata:\n  version: ${version}\n---\n`);
};

const deps = (...repoPaths: string[]) =>
  ({
    repoService: { listByProject: async () => repoPaths.map((path, index) => ({ id: `r${index}`, path })) },
    harnessRegistry: {
      list: async () => [
        {
          id: "pstdio.harness-claude-code.claude-code",
          extensionId: "pstdio.harness-claude-code",
          skills: { dir: ".claude/skills", globalDir: ".claude/skills" },
        },
      ],
    },
  }) as never;

const catalog = (version: string) => [
  { path: "SKILL.md", content: `---\nmetadata:\n  version: ${version}\n---\n`, encoding: "utf8" as const },
];

describe("getSkillInstallStatus", () => {
  test("is not outdated when the installed version matches the catalog (even if content drifts)", async () => {
    const repo = tempRepo();
    writeInstalledSkill(repo, "create-ticket", "1.2.0");

    const status = await getSkillInstallStatus(deps(repo), {
      projectId: "p1",
      name: "create-ticket",
      files: catalog("1.2.0"),
    });

    expect(status.outdated_agents).toEqual([]);
    expect(status.agent_installations[0]).toMatchObject({ installed_version: "1.2.0", outdated: false });
  });

  test("is outdated when the installed version differs from the catalog", async () => {
    const repo = tempRepo();
    writeInstalledSkill(repo, "create-ticket", "1.1.0");

    const status = await getSkillInstallStatus(deps(repo), {
      projectId: "p1",
      name: "create-ticket",
      files: catalog("1.2.0"),
    });

    expect(status.outdated_agents).toEqual(["pstdio.harness-claude-code.claude-code"]);
    expect(status.agent_installations[0]).toMatchObject({ installed_version: "1.1.0", outdated: true });
  });

  test("falls back to content comparison when the catalog skill has no version", async () => {
    const repo = tempRepo();
    const dir = join(repo, ".claude/skills", "create-ticket");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "# Old body\n");

    const status = await getSkillInstallStatus(deps(repo), {
      projectId: "p1",
      name: "create-ticket",
      files: [{ path: "SKILL.md", content: "# New body\n", encoding: "utf8" }],
    });

    expect(status.outdated_agents).toEqual(["pstdio.harness-claude-code.claude-code"]);
    expect(status.agent_installations[0]).toMatchObject({ installed_version: null, outdated: true });
  });

  test("an unversioned skill whose content matches the catalog is not outdated", async () => {
    const repo = tempRepo();
    const dir = join(repo, ".claude/skills", "create-ticket");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "# Same body\n");

    const status = await getSkillInstallStatus(deps(repo), {
      projectId: "p1",
      name: "create-ticket",
      files: [{ path: "SKILL.md", content: "# Same body\n", encoding: "utf8" }],
    });

    expect(status.outdated_agents).toEqual([]);
    expect(status.agent_installations[0]).toMatchObject({ installed_version: null, outdated: false });
  });

  // Root workspace provisioning can write a skill into every linked repo, so a session in a
  // lagging repo runs the old skill even when the first repo is current. Status must reflect
  // every installed copy, not just the first one found.
  test("is outdated when a second repo holds a stale versioned copy", async () => {
    const current = tempRepo();
    const stale = tempRepo();
    writeInstalledSkill(current, "create-ticket", "1.2.0");
    writeInstalledSkill(stale, "create-ticket", "1.1.0");

    const status = await getSkillInstallStatus(deps(current, stale), {
      projectId: "p1",
      name: "create-ticket",
      files: catalog("1.2.0"),
    });

    expect(status.outdated_agents).toEqual(["pstdio.harness-claude-code.claude-code"]);
    expect(status.agent_installations[0]).toMatchObject({ outdated: true });
  });

  test("is outdated when a second repo holds a stale unversioned copy", async () => {
    const current = tempRepo();
    const stale = tempRepo();
    const writeBody = (repoPath: string, body: string) => {
      const dir = join(repoPath, ".claude/skills", "create-ticket");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "SKILL.md"), body);
    };
    writeBody(current, "# Same body\n");
    writeBody(stale, "# Old body\n");

    const status = await getSkillInstallStatus(deps(current, stale), {
      projectId: "p1",
      name: "create-ticket",
      files: [{ path: "SKILL.md", content: "# Same body\n", encoding: "utf8" }],
    });

    expect(status.outdated_agents).toEqual(["pstdio.harness-claude-code.claude-code"]);
    expect(status.agent_installations[0]).toMatchObject({ outdated: true });
  });
});
