import { afterEach, expect, test } from "bun:test";
import { mkdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { artifactFilesFixture } from "./artifact-files.fixture";
import { createSharedArtifactMount } from "./artifact-mount";

const fixtures: Awaited<ReturnType<typeof artifactFilesFixture>>[] = [];
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.close();
});
const fixture = async () => {
  const result = await artifactFilesFixture();
  fixtures.push(result);
  return result;
};

test("ordinary mounts hydrate saved bytes and remote updates without recapturing old disk content", async () => {
  const f = await fixture();
  await f.replace("documents/note.md", "from another environment");
  const mount = f.mount();
  expect(await mount.readText("note.md")).toBe("from another environment");
  const saved = await f.storage.records.list();
  await mount.list();
  expect(await f.storage.records.list()).toEqual(saved);
  await f.replace("documents/note.md", "new remote bytes");
  await mount.refresh();
  expect(await readFile(f.pathFor("documents/note.md"), "utf8")).toBe("new remote bytes");
  expect(await f.storage.records.list()).not.toEqual(saved);
});

test("agent filesystem edits and renames become durable operations and survive recreating the mount", async () => {
  const f = await fixture();
  const mount = f.mount();
  await mount.writeText("before.md", "first");
  await writeFile(f.pathFor("documents/before.md"), "saved by an agent");
  await rename(f.pathFor("documents/before.md"), f.pathFor("documents/after.md"));
  await f.mount().refresh();
  expect((await f.storage.records.read(f.recordId("documents/before.md"))).deleted).toBe(true);
  const after = await f.storage.records.read(f.recordId("documents/after.md"));
  expect(await new Response(await f.assets.read(f.owner, after.asset!)).text()).toBe("saved by an agent");
  await rm(f.pathFor("documents/after.md"));
  await f.mount().refresh();
  expect((await f.storage.records.read(f.recordId("documents/after.md"))).deleted).toBe(true);
});

test("remote deletion removes materialized files and remains deleted after restarting the mount", async () => {
  const f = await fixture();
  await f.mount().writeText("note.md", "saved");
  await f.replace("documents/note.md", null);
  await f.mount().refresh();
  expect(await f.mount().exists("note.md")).toBe(false);
});

test("an offline filesystem edit saves the current file through the ordinary mount", async () => {
  const f = await fixture();
  await f.mount().writeText("note.md", "base");
  await f.replace("documents/note.md", "remote edit");
  await writeFile(f.pathFor("documents/note.md"), "offline local edit");
  await f.mount().refresh();
  expect(await f.mount().readText("note.md")).toBe("offline local edit");
});

test("overlapping mounts share one file identity and concurrent writes leave complete bytes", async () => {
  const f = await fixture();
  await f.mount().writeText("nested/note.md", "base");
  expect(await f.mount("documents/nested").readText("note.md")).toBe("base");
  await Promise.all([
    f.mount().writeText("nested/note.md", "first"),
    f.mount("documents/nested").writeText("note.md", "second"),
  ]);
  expect(await f.mount().readText("nested/note.md")).toBe("second");
  expect(
    (await f.storage.records.list()).filter((record) => record.recordId === f.recordId("documents/nested/note.md")),
  ).toHaveLength(1);
});

test("file mounts reject paths and symlinks outside their declared root", async () => {
  const f = await fixture();
  await f.mount().writeText("safe.md", "safe");
  const outside = f.pathFor("other/secret.md");
  await mkdir(dirname(outside), { recursive: true });
  await writeFile(outside, "private");
  await symlink(outside, f.pathFor("documents/escape.md"));
  await expect(f.mount().readText("../other/secret.md")).rejects.toThrow();
  await expect(f.mount().readText("escape.md")).rejects.toThrow();
  expect(await readFile(outside, "utf8")).toBe("private");
});

test("file and directory replacements project deletions before incoming files", async () => {
  const f = await fixture();
  await f.mount().writeText("item", "old file");
  await f.replace("documents/item", null);
  await f.replace("documents/item/note.md", "nested remote file");
  await f.mount().refresh();
  expect(await f.mount().readText("item/note.md")).toBe("nested remote file");
  await f.replace("documents/item/note.md", null);
  await f.replace("documents/item", "new flat file");
  await f.mount().refresh();
  expect(await f.mount().readText("item")).toBe("new flat file");
});

test("replacing a tracked file with an allowed symlink preserves the link target", async () => {
  const f = await fixture();
  await f.mount().writeText("note.md", "original");
  await f.mount().writeText("target.md", "linked edit");
  await rm(f.pathFor("documents/note.md"));
  await symlink(f.pathFor("documents/target.md"), f.pathFor("documents/note.md"));
  await f.mount().refresh();
  expect(await f.mount().readText("note.md")).toBe("linked edit");
  expect(await readFile(f.pathFor("documents/target.md"), "utf8")).toBe("linked edit");
});

test("write notifications keep the workspace path used by filesystem watchers", async () => {
  const f = await fixture();
  await mkdir(f.input.repoRoot, { recursive: true });
  const alias = join(f.root, "workspace-link");
  await symlink(f.input.repoRoot, alias, "junction");
  const writes: string[] = [];
  const mount = createSharedArtifactMount(f.deps, {
    ...f.input,
    repoRoot: alias,
    onWrite: (path) => writes.push(path),
  });
  await mount.writeText("note.md", "saved through linked workspace");
  expect(writes).toContain(join(alias, ".pstdio/extension-storage/example.documents/documents/note.md"));
});
