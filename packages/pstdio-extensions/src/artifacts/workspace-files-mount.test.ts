import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkspaceFilesMount } from "./artifact-mount";

const tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-wsfiles-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("createWorkspaceFilesMount.syncDir", () => {
  test("writes the given set, then updates and prunes to match a smaller set", async () => {
    const root = createTempDir();
    const mount = createWorkspaceFilesMount(root);

    await mount.syncDir(".claude/skills", [
      { path: "a/SKILL.md", content: "A" },
      { path: "b/SKILL.md", content: "B" },
    ]);
    expect(readFileSync(join(root, ".claude/skills/a/SKILL.md"), "utf8")).toBe("A");
    expect(readFileSync(join(root, ".claude/skills/b/SKILL.md"), "utf8")).toBe("B");

    await mount.syncDir(".claude/skills", [{ path: "a/SKILL.md", content: "A2" }]);
    expect(readFileSync(join(root, ".claude/skills/a/SKILL.md"), "utf8")).toBe("A2");
    expect(existsSync(join(root, ".claude/skills/b/SKILL.md"))).toBe(false);
  });

  test("leaves files outside the synced dir untouched", async () => {
    const root = createTempDir();
    const mount = createWorkspaceFilesMount(root);

    await mount.writeText(".pstdio/config.json", "{}");
    await mount.syncDir(".claude/skills", [{ path: "a/SKILL.md", content: "A" }]);

    expect(existsSync(join(root, ".pstdio/config.json"))).toBe(true);
  });

  test("rejects file paths that escape the synced dir", async () => {
    const root = createTempDir();
    const mount = createWorkspaceFilesMount(root);

    await expect(mount.syncDir(".claude/skills", [{ path: "../outside.txt", content: "x" }])).rejects.toThrow(
      /escapes/,
    );
    await expect(mount.syncDir(".claude/skills", [{ path: "skill/../../outside.txt", content: "x" }])).rejects.toThrow(
      /escapes/,
    );
    expect(existsSync(join(root, ".claude/outside.txt"))).toBe(false);
    expect(existsSync(join(root, "outside.txt"))).toBe(false);
  });
});
