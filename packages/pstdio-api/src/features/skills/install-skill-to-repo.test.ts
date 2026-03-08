import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installSkillToRepo } from "./install-skill-to-repo";

const tempRoot = mkdtempSync(join(tmpdir(), "install-skill-test-"));

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("installSkillToRepo", () => {
  test("writes SKILL.md to agent skills directory", () => {
    const repoPath = join(tempRoot, "repo1");

    installSkillToRepo(repoPath, "claude-code", "my-skill", "# My Skill");

    const skillPath = join(repoPath, ".claude", "skills", "my-skill", "SKILL.md");
    expect(existsSync(skillPath)).toBe(true);
    expect(readFileSync(skillPath, "utf8")).toBe("# My Skill");
  });

  test("writes to opencode skills directory", () => {
    const repoPath = join(tempRoot, "repo2");

    installSkillToRepo(repoPath, "opencode", "my-skill", "# My Skill");

    const skillPath = join(repoPath, ".opencode", "skills", "my-skill", "SKILL.md");
    expect(existsSync(skillPath)).toBe(true);
  });

  test("does nothing for unknown agent", () => {
    const repoPath = join(tempRoot, "repo3");

    installSkillToRepo(repoPath, "unknown-agent", "my-skill", "# My Skill");

    expect(existsSync(repoPath)).toBe(false);
  });
});
