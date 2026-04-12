import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import { installSkillToRepo, resolveSafeSkillFilePath } from "./install-skill-to-repo";

const SKILL_FILES = [
  { path: "SKILL.md", content: "# My Skill", encoding: "utf8" as const },
  { path: "templates/example.md", content: "# template", encoding: "utf8" as const },
];

const tempRoot = mkdtempSync(join(tmpdir(), "install-skill-test-"));

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("installSkillToRepo", () => {
  test("writes SKILL.md to agent skills directory", () => {
    const repoPath = join(tempRoot, "repo1");

    installSkillToRepo(repoPath, "claude-code", "my-skill", SKILL_FILES);

    const skillPath = join(repoPath, ".claude", "skills", "my-skill", "SKILL.md");
    expect(existsSync(skillPath)).toBe(true);
    expect(readFileSync(skillPath, "utf8")).toBe("# My Skill");
    expect(existsSync(join(repoPath, ".claude", "skills", "my-skill", "templates", "example.md"))).toBe(true);
  });

  test("writes to opencode skills directory", () => {
    const repoPath = join(tempRoot, "repo2");

    installSkillToRepo(repoPath, "opencode", "my-skill", SKILL_FILES);

    const skillPath = join(repoPath, ".opencode", "skills", "my-skill", "SKILL.md");
    expect(existsSync(skillPath)).toBe(true);
  });

  test("does nothing for unknown agent", () => {
    const repoPath = join(tempRoot, "repo3");

    installSkillToRepo(repoPath, "unknown-agent", "my-skill", SKILL_FILES);

    expect(existsSync(repoPath)).toBe(false);
  });

  test("preserves an existing repo-local skill", () => {
    const repoPath = join(tempRoot, "repo4");
    const skillPath = join(repoPath, ".claude", "skills", "my-skill", "SKILL.md");
    mkdirSync(join(repoPath, ".claude", "skills", "my-skill"), { recursive: true });
    writeFileSync(skillPath, "# Local Customization");

    installSkillToRepo(repoPath, "claude-code", "my-skill", [
      { path: "SKILL.md", content: "# Bundled Skill", encoding: "utf8" },
    ]);

    expect(readFileSync(skillPath, "utf8")).toBe("# Local Customization");
  });

  test("overwrites an existing repo-local skill when overwrite is enabled", () => {
    const repoPath = join(tempRoot, "repo5");
    const skillPath = join(repoPath, ".claude", "skills", "my-skill", "SKILL.md");
    mkdirSync(join(repoPath, ".claude", "skills", "my-skill"), { recursive: true });
    writeFileSync(skillPath, "# Local Customization");

    installSkillToRepo(
      repoPath,
      "claude-code",
      "my-skill",
      [{ path: "SKILL.md", content: "# Bundled Skill", encoding: "utf8" }],
      {
        overwrite: true,
      },
    );

    expect(readFileSync(skillPath, "utf8")).toBe("# Bundled Skill");
  });

  test("skips repo-local install when the skill already exists globally", () => {
    const repoPath = join(tempRoot, "repo6");
    const homePath = join(tempRoot, "home");
    const globalSkillPath = join(homePath, ".claude", "skills", "my-skill", "SKILL.md");
    mkdirSync(join(homePath, ".claude", "skills", "my-skill"), { recursive: true });
    writeFileSync(globalSkillPath, "# Global Skill");

    installSkillToRepo(
      repoPath,
      "claude-code",
      "my-skill",
      [{ path: "SKILL.md", content: "# Bundled Skill", encoding: "utf8" }],
      {
        homedir: homePath,
      },
    );

    expect(existsSync(join(repoPath, ".claude", "skills", "my-skill", "SKILL.md"))).toBe(false);
  });

  test("removes old files when overwrite is enabled", () => {
    const repoPath = join(tempRoot, "repo7");
    const skillDir = join(repoPath, ".claude", "skills", "my-skill");
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(join(skillDir, "templates"), { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# old");
    writeFileSync(join(skillDir, "templates", "old.md"), "old", "utf8");

    installSkillToRepo(
      repoPath,
      "claude-code",
      "my-skill",
      [{ path: "SKILL.md", content: "# new", encoding: "utf8" }],
      {
        overwrite: true,
      },
    );

    expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);
    expect(existsSync(join(skillDir, "templates", "old.md"))).toBe(false);
  });

  test("rejects parent-directory traversal in file paths", () => {
    const repoPath = join(tempRoot, "repo8");

    expect(() =>
      installSkillToRepo(repoPath, "claude-code", "my-skill", [
        { path: "../outside.md", content: "nope", encoding: "utf8" },
      ]),
    ).toThrow("Invalid skill file path");
  });

  test("rejects absolute file paths", () => {
    const repoPath = join(tempRoot, "repo9");

    expect(() =>
      installSkillToRepo(repoPath, "claude-code", "my-skill", [
        { path: "/tmp/escape.md", content: "nope", encoding: "utf8" },
      ]),
    ).toThrow("Invalid skill file path");
  });

  test("accepts valid nested paths with win32 path semantics", () => {
    const resolved = resolveSafeSkillFilePath("C:\\repo\\.claude\\skills\\my-skill", "templates/example.md", {
      isAbsolute: win32.isAbsolute,
      relative: win32.relative,
      resolve: win32.resolve,
    });

    expect(resolved).toBe("C:\\repo\\.claude\\skills\\my-skill\\templates\\example.md");
  });

  test("keeps existing files when overwrite input contains invalid path", () => {
    const repoPath = join(tempRoot, "repo10");
    const skillDir = join(repoPath, ".claude", "skills", "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# existing", "utf8");

    expect(() =>
      installSkillToRepo(
        repoPath,
        "claude-code",
        "my-skill",
        [
          { path: "SKILL.md", content: "# new", encoding: "utf8" },
          { path: "../escape.md", content: "bad", encoding: "utf8" },
        ],
        { overwrite: true },
      ),
    ).toThrow("Invalid skill file path");

    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toBe("# existing");
  });
});
