import { expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expectRejection } from "../test-utils/expect-rejection";
import { migrateExtensionFiles } from "./extension-file-migration";

test("interrupted file migration resumes using equal files and retains unsaved drafts and attachments", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-upgrade-"));
  const source = join(root, ".pstdio/extension-storage/pstdio.pstdio-notes");
  const target = join(root, ".pstdio/extension-storage/pstdio.notes");
  try {
    await mkdir(join(source, "drafts"), { recursive: true });
    await mkdir(join(target, "drafts"), { recursive: true });
    await writeFile(join(source, "drafts/note.md"), "Unsaved ideas");
    await writeFile(join(target, "drafts/note.md"), "Unsaved ideas");
    await writeFile(join(source, "attachment.bin"), new Uint8Array([0, 255, 4]));
    await migrateExtensionFiles(root);
    expect(await readFile(join(target, "drafts/note.md"), "utf8")).toBe("Unsaved ideas");
    expect(new Uint8Array(await readFile(join(target, "attachment.bin")))).toEqual(new Uint8Array([0, 255, 4]));
    expect(await Bun.file(join(source, "attachment.bin")).exists()).toBe(false);
    await migrateExtensionFiles(root);
    expect(await readFile(join(target, "drafts/note.md"), "utf8")).toBe("Unsaved ideas");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("conflicting files preserve both trees, and symlinks cannot escape the workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-conflict-"));
  const old = join(root, ".pstdio/extension-storage/pstdio.pstdio-planner");
  const next = join(root, ".pstdio/extension-storage/pstdio.planner");
  try {
    await mkdir(old, { recursive: true });
    await mkdir(next, { recursive: true });
    await writeFile(join(old, "ticket.md"), "old draft");
    await writeFile(join(next, "ticket.md"), "new draft");
    await expectRejection(migrateExtensionFiles(root)).toThrow(/conflict/i);
    expect(await readFile(join(old, "ticket.md"), "utf8")).toBe("old draft");
    expect(await readFile(join(next, "ticket.md"), "utf8")).toBe("new draft");
    await rm(next, { recursive: true });
    await symlink(tmpdir(), next, "dir");
    await expectRejection(migrateExtensionFiles(root)).toThrow(/symbolic/i);
    expect(await readFile(join(old, "ticket.md"), "utf8")).toBe("old draft");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
  "verified files become active when permissions prevent deleting the original",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "extension-cleanup-"));
    const source = join(root, ".pstdio/extension-storage/pstdio.pstdio-artifacts");
    const target = join(root, ".pstdio/extension-storage/pstdio.artifacts");
    const backup = join(target, ".extension-identity-original");
    try {
      await mkdir(join(source, "drafts"), { recursive: true });
      await writeFile(join(source, "drafts/draft.html"), "Unsaved draft");
      await chmod(join(source, "drafts"), 0o555);
      await migrateExtensionFiles(root);
      expect(await readFile(join(target, "drafts/draft.html"), "utf8")).toBe("Unsaved draft");
      expect(await readFile(join(backup, "drafts/draft.html"), "utf8")).toBe("Unsaved draft");
      await migrateExtensionFiles(root);
    } finally {
      await Promise.all([source, backup].map((path) => chmod(join(path, "drafts"), 0o755).catch(() => {})));
      await rm(root, { recursive: true, force: true });
    }
  },
);

test("retained originals stay inside their owner and cannot appear as live artifacts", async () => {
  const { retainExtensionMigrationSource } = await import("./extension-file-migration");
  const { createFileMount } = await import("./artifact-mount");
  const root = await mkdtemp(join(tmpdir(), "extension-original-"));
  const source = join(root, ".pstdio/extension-storage/pstdio.pstdio-notes");
  const target = join(root, ".pstdio/extension-storage/pstdio.notes");
  try {
    await mkdir(source, { recursive: true });
    await mkdir(target, { recursive: true });
    await writeFile(join(source, "note.md"), "Original");
    await writeFile(join(target, "note.md"), "Original");
    await retainExtensionMigrationSource(source, target);
    await retainExtensionMigrationSource(source, target);
    expect(await readFile(join(target, ".extension-identity-original/note.md"), "utf8")).toBe("Original");
    const mount = createFileMount(target);
    expect((await mount.list()).map((file) => file.path)).toEqual(["note.md"]);
    await expectRejection(mount.writeText(".extension-identity-original/note.md", "Changed")).toThrow(/retained/);
    await symlink(join(target, ".extension-identity-original"), join(target, "alias"), "junction");
    await expectRejection(mount.readText("alias/note.md")).toThrow(/retained/);
    await expectRejection(mount.writeText("alias/new.md", "Changed")).toThrow(/retained/);
    await mkdir(source);
    await writeFile(join(source, "note.md"), "Different");
    await expectRejection(retainExtensionMigrationSource(source, target)).toThrow(/conflict/);
    expect(await readFile(join(source, "note.md"), "utf8")).toBe("Different");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
