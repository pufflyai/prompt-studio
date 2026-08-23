import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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

describe("createWorkspaceFilesMount browsing", () => {
  test("lists immediate files and directories without exposing .git", async () => {
    const root = createTempDir();
    mkdirSync(join(root, ".git/objects"), { recursive: true });
    mkdirSync(join(root, "src/nested"), { recursive: true });
    writeFileSync(join(root, ".git/config"), "private");
    writeFileSync(join(root, "README.md"), "readme");
    writeFileSync(join(root, "src/index.ts"), "export {};");
    const mount = createWorkspaceFilesMount(root);

    expect((await mount.listEntries()).map(({ name, path, type }) => ({ name, path, type }))).toEqual([
      { name: "src", path: "src", type: "directory" },
      { name: "README.md", path: "README.md", type: "file" },
    ]);
    expect((await mount.listEntries("src")).map(({ path, type }) => ({ path, type }))).toEqual([
      { path: "src/nested", type: "directory" },
      { path: "src/index.ts", type: "file" },
    ]);
  });

  test("searches files and directories in stable order and stops after limit plus one", async () => {
    const root = createTempDir();
    mkdirSync(join(root, ".git"), { recursive: true });
    mkdirSync(join(root, "docs"), { recursive: true });
    mkdirSync(join(root, "match-dir"), { recursive: true });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, ".git/match-secret"), "private");
    writeFileSync(join(root, "docs/match-notes.md"), "notes");
    writeFileSync(join(root, "match-dir/file.txt"), "text");
    writeFileSync(join(root, "src/match.ts"), "export {};");
    const mount = createWorkspaceFilesMount(root);

    const result = await mount.searchEntries("match", 2);

    expect(result.entries.map((entry) => entry.path)).toEqual(["match-dir", "docs/match-notes.md"]);
    expect(result.truncated).toBe(true);
    expect(result.entries.every((entry) => !entry.path.startsWith(".git"))).toBe(true);
  });

  test("creates, reads, updates, and deletes workspace entries", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "notes.txt"), "before");
    const mount = createWorkspaceFilesMount(root);

    await mount.createTextFile("docs/new.md", "new", 16);
    expect(readFileSync(join(root, "docs/new.md"), "utf8")).toBe("new");

    const file = await mount.readFile("notes.txt", 16);
    expect(new TextDecoder().decode(file.bytes)).toBe("before");
    expect(file.size).toBe(6);
    expect(await mount.resolveEntryPath("docs")).toEqual({
      absolutePath: realpathSync(join(root, "docs")),
      type: "directory",
    });
    expect(await mount.resolveEntryPath("notes.txt")).toEqual({
      absolutePath: realpathSync(join(root, "notes.txt")),
      type: "file",
    });

    await mount.writeTextFile("notes.txt", "after", 16);
    expect(readFileSync(join(root, "notes.txt"), "utf8")).toBe("after");
    await mount.deleteEntry("notes.txt");
    expect(existsSync(join(root, "notes.txt"))).toBe(false);

    mkdirSync(join(root, "delete-me/nested"), { recursive: true });
    writeFileSync(join(root, "delete-me/nested/file.txt"), "nested");
    await mount.deleteEntry("delete-me");
    expect(existsSync(join(root, "delete-me"))).toBe(false);

    mkdirSync(join(root, ".git"));
    writeFileSync(join(root, ".git/config"), "protected");
    await expect(mount.deleteEntry(".git")).rejects.toThrow(/git metadata/i);
    expect(existsSync(join(root, ".git/config"))).toBe(true);

    await expect(mount.createTextFile("docs/new.md", "duplicate", 16)).rejects.toThrow(/already exists/i);
    await expect(mount.createTextFile("missing/new.md", "new", 16)).rejects.toThrow(/not found/i);
    await expect(mount.writeTextFile("missing.txt", "new", 16)).rejects.toThrow(/not found/i);
    await expect(mount.createTextFile("large.txt", "too long", 3)).rejects.toThrow(/too large/i);
    await expect(mount.deleteEntry("")).rejects.toThrow(/workspace root/i);
  });

  test("creates one directory under an existing parent without replacing entries", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "existing.txt"), "keep");
    const mount = createWorkspaceFilesMount(root);

    await mount.createDirectory("docs/generated");

    expect(await mount.resolveEntryPath("docs/generated")).toMatchObject({ type: "directory" });
    await expect(mount.createDirectory("existing.txt")).rejects.toThrow(/already exists/i);
    await expect(mount.createDirectory("missing/generated")).rejects.toThrow(/not found/i);
  });

  test("moves and renames files and directories without replacing existing entries", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "docs"));
    mkdirSync(join(root, "source/nested"), { recursive: true });
    writeFileSync(join(root, "notes.txt"), "notes");
    writeFileSync(join(root, "docs/existing.txt"), "keep");
    writeFileSync(join(root, "source/nested/file.txt"), "nested");
    const mount = createWorkspaceFilesMount(root);

    await mount.moveEntry("notes.txt", "docs/renamed.txt");
    await mount.moveEntry("source", "docs/source-renamed");

    expect(existsSync(join(root, "notes.txt"))).toBe(false);
    expect(readFileSync(join(root, "docs/renamed.txt"), "utf8")).toBe("notes");
    expect(existsSync(join(root, "source"))).toBe(false);
    expect(readFileSync(join(root, "docs/source-renamed/nested/file.txt"), "utf8")).toBe("nested");
    await expect(mount.moveEntry("docs/renamed.txt", "docs/existing.txt")).rejects.toThrow(/already exists/i);
    await expect(mount.moveEntry("docs", "docs/source-renamed/docs")).rejects.toThrow(/inside itself/i);
    expect(readFileSync(join(root, "docs/existing.txt"), "utf8")).toBe("keep");
  });
});
