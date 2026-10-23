import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExtensionStorageConflictError, extensionStorageDirectory, migrateExtensionStorage } from "./storage-migration";

const roots: string[] = [];
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-storage-"));
  roots.push(root);
  return root;
};
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
test("moves existing artifacts and private files once and keeps legacy paths on the same data", async () => {
  const root = await fixture();
  const old = join(root, ".pstdio/extension-storage/notes");
  const next = join(root, ".pstdio/extension-storage/alice.notes");
  await mkdir(join(old, "notes"), { recursive: true });
  await mkdir(join(old, ".publishers/alice"), { recursive: true });
  await writeFile(join(old, "notes/one.md"), "one");
  await writeFile(join(old, ".publishers/alice/settings.json"), "{}");
  await migrateExtensionStorage(root, [{ name: "notes", extensionId: "alice.notes" }]);
  expect(await readFile(join(next, "notes/one.md"), "utf8")).toBe("one");
  expect(await readFile(join(next, "settings.json"), "utf8")).toBe("{}");
  expect(await realpath(old)).toBe(await realpath(next));
  await writeFile(join(old, ".publishers/alice/settings.json"), "updated");
  expect(await readFile(join(next, "settings.json"), "utf8")).toBe("updated");
  await migrateExtensionStorage(root, [{ name: "notes", extensionId: "alice.notes" }]);
});
test("separates publishers and removes an ambiguous legacy alias", async () => {
  const root = await fixture();
  await migrateExtensionStorage(root, [{ name: "notes", extensionId: "alice.notes" }]);
  await migrateExtensionStorage(root, [
    { name: "notes", extensionId: "alice.notes" },
    { name: "notes", extensionId: "bob.notes" },
  ]);
  expect(await realpath(join(root, ".pstdio/extension-storage/alice.notes"))).not.toBe(
    await realpath(join(root, ".pstdio/extension-storage/bob.notes")),
  );
  await expect(realpath(join(root, ".pstdio/extension-storage/notes"))).rejects.toThrow();
});
test("maps accepted Windows device-name publishers to distinct portable folders", () => {
  expect(extensionStorageDirectory("con.notes")).toBe("_con.notes");
  expect(extensionStorageDirectory("com1.notes")).toBe("_com1.notes");
  expect(extensionStorageDirectory("alice.notes")).toBe("alice.notes");
  expect(() => extensionStorageDirectory("../notes")).toThrow();
});

test("preserves every persisted publisher when only one owner is enabled", async () => {
  const root = await fixture();
  const legacy = join(root, ".pstdio/extension-storage/notes");
  for (const publisher of ["alice", "bob"]) {
    await mkdir(join(legacy, ".publishers", publisher), { recursive: true });
    await writeFile(join(legacy, ".publishers", publisher, "private.json"), publisher);
  }
  await migrateExtensionStorage(root, [{ name: "notes", extensionId: "alice.notes" }]);
  expect(await readFile(join(root, ".pstdio/extension-storage/bob.notes/private.json"), "utf8")).toBe("bob");
  await expect(
    readFile(join(root, ".pstdio/extension-storage/alice.notes/.publishers/bob/private.json")),
  ).rejects.toThrow();
});
test("keeps moved private files excluded from Git", async () => {
  const root = await fixture();
  const git = (...args: string[]) => Bun.spawnSync(["git", ...args], { cwd: root });
  git("init", "-q");
  await mkdir(join(root, ".pstdio/extension-storage/notes/.publishers/alice"), { recursive: true });
  await writeFile(join(root, ".pstdio/extension-storage/notes/.publishers/alice/draft.md"), "private");
  const previousRule = "/extension-storage/notes/.publishers/alice/";
  await writeFile(join(root, ".pstdio/.gitignore"), `# pstdio:ignore-owned ${previousRule}\n${previousRule}\n`);
  await migrateExtensionStorage(root, [{ name: "notes", extensionId: "alice.notes" }]);
  expect(git("check-ignore", "-q", ".pstdio/extension-storage/alice.notes/draft.md").exitCode).toBe(0);
});
test("a conflict in one extension's storage still moves the others and names the conflicted owner", async () => {
  const root = await fixture();
  await mkdir(join(root, ".pstdio/extension-storage/notes"), { recursive: true });
  await mkdir(join(root, ".pstdio/extension-storage/alice.notes"), { recursive: true });
  await mkdir(join(root, ".pstdio/extension-storage/tasks"), { recursive: true });
  await writeFile(join(root, ".pstdio/extension-storage/tasks/one.md"), "one");
  const error = await migrateExtensionStorage(root, [
    { name: "notes", extensionId: "alice.notes" },
    { name: "tasks", extensionId: "alice.tasks" },
  ]).catch((caught) => caught);
  expect(error).toBeInstanceOf(ExtensionStorageConflictError);
  expect(error.extensionIds).toEqual(["alice.notes"]);
  expect(await readFile(join(root, ".pstdio/extension-storage/alice.tasks/one.md"), "utf8")).toBe("one");
});
