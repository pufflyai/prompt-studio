import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionFilesApi } from "./extension-files";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const createRepo = async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-extension-files-"));
  roots.push(root);
  await mkdir(join(root, ".pstdio"));
  return root;
};

describe("extension files ignore ownership", () => {
  test.each(["/extension-storage", "/extension-storage/"])("keeps an existing %s rule unchanged", async (rule) => {
    const repo = await createRepo();
    const ignorePath = join(repo, ".pstdio/.gitignore");
    writeFileSync(ignorePath, `${rule}\n`);
    const files = createExtensionFilesApi({
      name: "first",
      extensionId: "pstdio.first",
      resolveRepoPath: async () => repo,
      tracked: false,
    });

    await files.writeText("one.txt", "1");

    expect(readFileSync(ignorePath, "utf8")).toBe(`${rule}\n`);
  });

  test("keeps files and tracking separate for publishers with the same package name", async () => {
    const repo = await createRepo();
    const files = (publisher: string, tracked: boolean) =>
      createExtensionFilesApi({
        name: "tools",
        extensionId: `${publisher}.tools`,
        resolveRepoPath: async () => repo,
        tracked,
      });
    await files("alice", false).writeText("settings.json", "Alice settings");
    expect(await files("bob", true).exists("settings.json")).toBe(false);
    await files("bob", true).writeText("settings.json", "Bob settings");

    expect(await files("alice", false).readText("settings.json")).toBe("Alice settings");
    expect(await files("bob", true).readText("settings.json")).toBe("Bob settings");
    const ignore = readFileSync(join(repo, ".pstdio/.gitignore"), "utf8");
    expect(ignore).toContain("/extension-storage/alice.tools/");
    expect(ignore).not.toContain("/extension-storage/bob.tools/");
  });

  test("keeps concurrent first-write entries for two extensions", async () => {
    const repo = await createRepo();
    const first = createExtensionFilesApi({
      name: "first",
      extensionId: "pstdio.first",
      resolveRepoPath: async () => repo,
      tracked: false,
    });
    const second = createExtensionFilesApi({
      name: "second",
      extensionId: "pstdio.second",
      resolveRepoPath: async () => repo,
      tracked: false,
    });

    await Promise.all([first.writeText("one.txt", "1"), second.writeText("two.txt", "2")]);

    const ignore = readFileSync(join(repo, ".pstdio/.gitignore"), "utf8");
    expect(ignore).toContain("/extension-storage/pstdio.first/");
    expect(ignore).toContain("/extension-storage/pstdio.second/");
  });

  test("does not restore an entry removed after the first write", async () => {
    const repo = await createRepo();
    const files = createExtensionFilesApi({
      name: "first",
      extensionId: "pstdio.first",
      resolveRepoPath: async () => repo,
      tracked: false,
    });
    await files.writeText("one.txt", "1");
    const ignorePath = join(repo, ".pstdio/.gitignore");
    writeFileSync(ignorePath, readFileSync(ignorePath, "utf8").replace("/extension-storage/pstdio.first/\n", ""));

    await files.writeText("two.txt", "2");

    expect(readFileSync(ignorePath, "utf8").split("\n")).not.toContain("/extension-storage/pstdio.first/");
  });

  test("tracked files remove only the ignore entry owned by the host", async () => {
    const repo = await createRepo();
    const ignorePath = join(repo, ".pstdio/.gitignore");
    writeFileSync(ignorePath, "/extension-storage/user-owned/.publishers/pstdio/\n");
    const tracked = createExtensionFilesApi({
      name: "user-owned",
      extensionId: "pstdio.user-owned",
      resolveRepoPath: async () => repo,
      tracked: true,
    });

    await tracked.writeText("one.txt", "1");

    expect(readFileSync(ignorePath, "utf8")).toBe("/extension-storage/user-owned/.publishers/pstdio/\n");
  });

  test("tracked files remove an entry previously added by the host", async () => {
    const repo = await createRepo();
    const untracked = createExtensionFilesApi({
      name: "first",
      extensionId: "pstdio.first",
      resolveRepoPath: async () => repo,
      tracked: false,
    });
    await untracked.writeText("one.txt", "1");
    const tracked = createExtensionFilesApi({
      name: "first",
      extensionId: "pstdio.first",
      resolveRepoPath: async () => repo,
      tracked: true,
    });

    await tracked.writeText("two.txt", "2");

    expect(readFileSync(join(repo, ".pstdio/.gitignore"), "utf8")).toBe("");
  });
});
