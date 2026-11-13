import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryRepoFiles } from "@pstdio/sdk/testing";
import { ensureTicketDraftsIgnored } from "./draft-storage";

test.each([
  "pstdio.pstdio-planner",
  "pstdio.planner",
])("ignoring %s drafts leaves another extension's project files trackable", async (extensionId) => {
  const root = await mkdtemp(join(tmpdir(), "planner-draft-ignore-"));
  try {
    expect(Bun.spawnSync(["git", "init", "--quiet", root]).exitCode).toBe(0);
    const files = createMemoryRepoFiles();
    await ensureTicketDraftsIgnored(files, extensionId);
    await Bun.write(join(root, ".pstdio/.gitignore"), await files.readText(".pstdio/.gitignore"));
    const ignored = (path: string) =>
      Bun.spawnSync(["git", "-C", root, "check-ignore", "--quiet", "--no-index", path]).exitCode === 0;

    expect(ignored(`.pstdio/extension-storage/${extensionId}/tickets/PS-1/ticket.md`)).toBe(true);
    expect(ignored(".pstdio/extension-storage/shared-docs/index.md")).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test.each([
  "/extension-storage",
  "/extension-storage/",
])("writing drafts keeps a tracked %s ignore rule clean", async (entry) => {
  const root = await mkdtemp(join(tmpdir(), "planner-existing-ignore-"));
  const path = ".pstdio/.gitignore";
  const files = createMemoryRepoFiles();
  await files.writeText(path, `${entry}\nconfig.json\n`);
  try {
    expect(Bun.spawnSync(["git", "init", "--quiet", root]).exitCode).toBe(0);
    await Bun.write(join(root, path), await files.readText(path));
    expect(Bun.spawnSync(["git", "-C", root, "add", path]).exitCode).toBe(0);

    await ensureTicketDraftsIgnored(files);
    await Bun.write(join(root, path), await files.readText(path));

    expect(Bun.spawnSync(["git", "-C", root, "diff", "--exit-code", "--", path]).exitCode).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writing drafts preserves an existing canonical owned ignore rule", async () => {
  const files = createMemoryRepoFiles();
  const existing = "config.json\n/extension-storage/pstdio.planner/\n!extension-storage/shared.txt\n";
  await files.writeText(".pstdio/.gitignore", existing);
  await ensureTicketDraftsIgnored(files, "pstdio.planner");
  await ensureTicketDraftsIgnored(files, "pstdio.planner");
  expect(await files.readText(".pstdio/.gitignore")).toBe(existing);
});
