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
  test("keeps concurrent first-write entries for two extensions", async () => {
    const repo = await createRepo();
    const first = createExtensionFilesApi({
      extensionId: "pstdio.first",
      resolveRepoPath: async () => repo,
      tracked: false,
    });
    const second = createExtensionFilesApi({
      extensionId: "pstdio.second",
      resolveRepoPath: async () => repo,
      tracked: false,
    });

    await Promise.all([first.writeText("one.txt", "1"), second.writeText("two.txt", "2")]);

    const ignore = readFileSync(join(repo, ".pstdio/.gitignore"), "utf8");
    expect(ignore).toContain("/ext/pstdio.first/");
    expect(ignore).toContain("/ext/pstdio.second/");
  });

  test("does not restore an entry removed after the first write", async () => {
    const repo = await createRepo();
    const files = createExtensionFilesApi({
      extensionId: "pstdio.first",
      resolveRepoPath: async () => repo,
      tracked: false,
    });
    await files.writeText("one.txt", "1");
    const ignorePath = join(repo, ".pstdio/.gitignore");
    writeFileSync(ignorePath, readFileSync(ignorePath, "utf8").replace("/ext/pstdio.first/\n", ""));

    await files.writeText("two.txt", "2");

    expect(readFileSync(ignorePath, "utf8").split("\n")).not.toContain("/ext/pstdio.first/");
  });

  test("tracked files remove only the ignore entry owned by the host", async () => {
    const repo = await createRepo();
    const ignorePath = join(repo, ".pstdio/.gitignore");
    writeFileSync(ignorePath, "/ext/pstdio.user-owned/\n");
    const tracked = createExtensionFilesApi({
      extensionId: "pstdio.user-owned",
      resolveRepoPath: async () => repo,
      tracked: true,
    });

    await tracked.writeText("one.txt", "1");

    expect(readFileSync(ignorePath, "utf8")).toBe("/ext/pstdio.user-owned/\n");
  });

  test("tracked files remove an entry previously added by the host", async () => {
    const repo = await createRepo();
    const untracked = createExtensionFilesApi({
      extensionId: "pstdio.first",
      resolveRepoPath: async () => repo,
      tracked: false,
    });
    await untracked.writeText("one.txt", "1");
    const tracked = createExtensionFilesApi({
      extensionId: "pstdio.first",
      resolveRepoPath: async () => repo,
      tracked: true,
    });

    await tracked.writeText("two.txt", "2");

    expect(readFileSync(join(repo, ".pstdio/.gitignore"), "utf8")).toBe("");
  });
});
