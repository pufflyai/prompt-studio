import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  test("preserves an existing repo-local skill", () => {
    const repoPath = join(tempRoot, "repo4");
    const skillPath = join(repoPath, ".claude", "skills", "my-skill", "SKILL.md");
    mkdirSync(join(repoPath, ".claude", "skills", "my-skill"), { recursive: true });
    writeFileSync(skillPath, "# Local Customization");

    installSkillToRepo(repoPath, "claude-code", "my-skill", "# Bundled Skill");

    expect(readFileSync(skillPath, "utf8")).toBe("# Local Customization");
  });

  test("overwrites an existing repo-local skill when overwrite is enabled", () => {
    const repoPath = join(tempRoot, "repo5");
    const skillPath = join(repoPath, ".claude", "skills", "my-skill", "SKILL.md");
    mkdirSync(join(repoPath, ".claude", "skills", "my-skill"), { recursive: true });
    writeFileSync(skillPath, "# Local Customization");

    installSkillToRepo(repoPath, "claude-code", "my-skill", "# Bundled Skill", { overwrite: true });

    expect(readFileSync(skillPath, "utf8")).toBe("# Bundled Skill");
  });

  test("skips repo-local install when the skill already exists globally", () => {
    const repoPath = join(tempRoot, "repo6");
    const homePath = join(tempRoot, "home");
    const globalSkillPath = join(homePath, ".claude", "skills", "my-skill", "SKILL.md");
    mkdirSync(join(homePath, ".claude", "skills", "my-skill"), { recursive: true });
    writeFileSync(globalSkillPath, "# Global Skill");

    installSkillToRepo(repoPath, "claude-code", "my-skill", "# Bundled Skill", { homedir: homePath });

    expect(existsSync(join(repoPath, ".claude", "skills", "my-skill", "SKILL.md"))).toBe(false);
  });
});
