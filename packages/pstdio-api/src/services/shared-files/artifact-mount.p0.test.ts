import { afterEach, expect, spyOn, test } from "bun:test";
import * as fsPromises from "node:fs/promises";
import { mkdir, readFile, rename, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createArtifactMountWriteLedger } from "../../features/extensions/artifact-mount-watch/write-ledger";
import { expectRejection } from "../../test-utils/expect-rejection";
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
  await expectRejection(f.mount().readText("../other/secret.md")).toThrow();
  await expectRejection(f.mount().readText("escape.md")).toThrow();
  expect(await readFile(outside, "utf8")).toBe("private");
});

test("an unchanged point read does not scan an unrelated file, while its own boundary stays enforced", async () => {
  const f = await fixture();
  const mount = f.mount();
  await mount.writeText("safe.md", "safe");
  await mount.writeText("other.md", "other");
  const outside = f.pathFor("outside/secret.md");
  await mkdir(dirname(outside), { recursive: true });
  await writeFile(outside, "private");
  await rm(f.pathFor("documents/other.md"));
  await symlink(outside, f.pathFor("documents/other.md"));
  expect(await mount.readText("safe.md")).toBe("safe");
  await expectRejection(mount.readText("other.md")).toThrow("escapes");
});

test("point reads observe remote replacements and deletions without returning stale disk bytes", async () => {
  const f = await fixture();
  const mount = f.mount();
  await mount.writeText("note.md", "before");
  expect(await mount.readText("note.md")).toBe("before");
  await f.replace("documents/note.md", "after");
  expect(await mount.readText("note.md")).toBe("after");
  await f.replace("documents/note.md", null);
  await expectRejection(mount.readText("note.md")).toThrow("not found");
  expect(await mount.exists("note.md")).toBe(false);
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
  const directories: string[] = [];
  const ledger = createArtifactMountWriteLedger(() => 0);
  const nested = join(alias, ".pstdio/extension-storage/example.documents/documents/nested");
  const mount = createSharedArtifactMount(f.deps, {
    ...f.input,
    repoRoot: alias,
    onWrite: (path, created, parentWrite) => {
      writes.push(path);
      directories.push(...(created?.keys() ?? []));
      ledger.record(path, created, parentWrite);
    },
  });
  await mount.writeText("note.md", "saved through linked workspace");
  await mount.writeText("nested/first.md", "created the directory");
  expect(ledger.dropEchoes([nested, join(nested, "first.md")], { keepMatchedWrites: true })).toEqual([]);
  await mount.writeText("nested/second.md", "used the existing directory");
  expect(ledger.dropEchoes([nested, join(nested, "second.md")], { keepMatchedWrites: true })).toEqual([]);
  expect(writes).toContain(join(alias, ".pstdio/extension-storage/example.documents/documents/note.md"));
  expect(directories).toEqual([nested]);
});

test("a mount reports the full-ID folder that filesystem watchers must observe", async () => {
  const f = await fixture();
  expect(f.mount().root).toBe(f.pathFor("documents"));
});

test("shared API writes advance only the watcher that already reported the outside folder change", async () => {
  const f = await fixture();
  const ledger = createArtifactMountWriteLedger(() => 0);
  const mount = createSharedArtifactMount(f.deps, { ...f.input, onWrite: ledger.record });
  const folder = f.pathFor("documents/sales");
  const archive = join(folder, "archive");
  const options = { keepMatchedWrites: true };
  const first = ledger.createEchoFilter();
  const second = ledger.createEchoFilter();
  await mount.writeText("sales/archive/first.json", "{}");
  await writeFile(join(archive, "external.json"), "outside");
  expect(first([archive], options)).toEqual([archive]);

  await mount.writeText("sales/archive/second.json", "{}");
  expect(first([folder], options)).toEqual([]);
  expect(second([folder], options)).toEqual([folder]);
});

test.each([
  ["folder", true],
  ["child", true],
  ["child", false],
])("a shared mount reports a returned subtree from a %s hint (dual watch: %s)", async (hint, keepMatchedWrites) => {
  const f = await fixture();
  const ledger = createArtifactMountWriteLedger(() => 0);
  const mount = createSharedArtifactMount(f.deps, { ...f.input, onWrite: ledger.record });
  const folder = f.pathFor("documents/sales");
  const nested = join(folder, "nested");
  const parked = f.pathFor("parked-nested");
  const returned = hint === "folder" ? nested : join(nested, "a.json");
  const removed = join(nested, "b.json");
  const options = { keepMatchedWrites };
  await mount.writeText("sales/nested/a.json", "{}");
  await mount.writeText("sales/nested/b.json", "{}");
  await rename(nested, parked);
  await mount.delete("sales");
  expect(ledger.dropEchoes([folder], options)).toEqual([]);
  await mount.writeText("sales/owned.json", "{}");

  await rename(parked, nested);
  expect(ledger.dropEchoes([returned], options)).toEqual([returned]);
  await rm(removed);
  expect(ledger.dropEchoes([removed], options)).toEqual([removed]);
});

test("a folder return retires shared mount child deletions that were not individually observed", async () => {
  const f = await fixture();
  const ledger = createArtifactMountWriteLedger(() => 0);
  const mount = createSharedArtifactMount(f.deps, { ...f.input, onWrite: ledger.record });
  const folder = f.pathFor("documents/sales");
  const child = join(folder, "q3.json");
  const options = { keepMatchedWrites: true };
  await mount.writeText("sales/q3.json", "{}");
  expect(ledger.dropEchoes([folder, child], options)).toEqual([]);
  await mount.delete("sales");
  expect(ledger.dropEchoes([folder, child], options)).toEqual([]);

  await mkdir(folder);
  await writeFile(child, "[]");
  expect(ledger.dropEchoes([folder], options)).toEqual([folder]);
  await rm(child);
  expect(ledger.dropEchoes([child], options)).toEqual([child]);
});

test("a child-only return hint preserves external removals and owned delete echoes in shared mounts", async () => {
  const f = await fixture();
  const ledger = createArtifactMountWriteLedger(() => 0);
  const mount = createSharedArtifactMount(f.deps, { ...f.input, onWrite: ledger.record });
  const missing = f.pathFor("documents/sales/old.json");
  const options = { keepMatchedWrites: true };
  await mount.writeText("sales/old.json", "{}");
  await mount.delete("sales");
  expect(ledger.dropEchoes([missing], options)).toEqual([]);
  await mount.writeText("sales/owned.json", "[]");

  const folder = f.pathFor("documents/sales/returned/nested");
  const hint = join(folder, "a.json");
  const child = join(folder, "b.json");
  const owned = join(folder, "owned.json");
  await mkdir(folder, { recursive: true });
  await writeFile(hint, "outside");
  await writeFile(child, "outside sibling");
  await writeFile(owned, "outside then deleted by API");
  await mount.delete("sales/returned/nested/owned.json");
  expect(ledger.dropEchoes([hint], options)).toEqual([hint]);

  await rm(child);
  expect(ledger.dropEchoes([child, missing, owned], options)).toEqual([child]);
});

test("a shared API deletion after an external folder return stays quiet", async () => {
  const f = await fixture();
  const ledger = createArtifactMountWriteLedger(() => 0);
  const mount = createSharedArtifactMount(f.deps, { ...f.input, onWrite: ledger.record });
  const folder = f.pathFor("documents/sales");
  const child = join(folder, "q3.json");
  const options = { keepMatchedWrites: true };
  await mount.writeText("sales/q3.json", "{}");
  await mount.delete("sales");
  expect(ledger.dropEchoes([folder, child], options)).toEqual([]);

  await mkdir(folder);
  await writeFile(child, "[]");
  await mount.delete("sales/q3.json");
  expect(ledger.dropEchoes([folder, child], options)).toEqual([folder]);
  expect(ledger.dropEchoes([child], options)).toEqual([]);
});

test.each([
  true,
  false,
])("an edited mount-owned folder preserves old deletion echoes (folder first: %s)", async (folderFirst) => {
  const f = await fixture();
  const ledger = createArtifactMountWriteLedger(() => 0);
  const mount = createSharedArtifactMount(f.deps, { ...f.input, onWrite: ledger.record });
  const folder = f.pathFor("documents/sales");
  const oldChild = join(folder, "old.json");
  const options = { keepMatchedWrites: true };
  await mount.writeText("sales/old.json", "{}");
  await mount.delete("sales");
  await mount.writeText("sales/new.json", "[]");
  await writeFile(join(folder, "external.json"), "{}");
  await utimes(folder, new Date(), new Date(Date.now() + 5_000));

  expect(ledger.dropEchoes([oldChild], options)).toEqual([]);
  const paths = folderFirst ? [folder, oldChild] : [oldChild, folder];
  expect(ledger.dropEchoes(paths, options)).toEqual([folder]);
  expect(ledger.dropEchoes([oldChild], options)).toEqual([]);
});

test("shared projection preserves an outside parent change during placement lookup", async () => {
  const f = await fixture();
  const ledger = createArtifactMountWriteLedger(() => 0);
  const mount = createSharedArtifactMount(f.deps, { ...f.input, onWrite: ledger.record });
  const folder = f.pathFor("documents/sales");
  const existing = join(folder, "existing.json");
  const child = join(folder, "child.json");
  const outside = f.pathFor("returned-sales");
  const options = { keepMatchedWrites: true };
  await mount.writeText("sales/existing.json", "{}");
  expect(ledger.dropEchoes([folder, existing], options)).toEqual([]);

  const makeDirectory = fsPromises.mkdir;
  const physicalFolder = await fsPromises.realpath(folder);
  let edited = false;
  const editDuringLookup = async (...args: Parameters<typeof makeDirectory>) => {
    if (!edited && args[0] === physicalFolder && args[1] === undefined) {
      edited = true;
      await rename(folder, outside);
      await writeFile(join(outside, "external.json"), "outside");
      await utimes(outside, new Date(), new Date(Date.now() + 5_000));
      await rename(outside, folder);
    }
    return Reflect.apply(makeDirectory, fsPromises, args);
  };
  const lookup = spyOn(fsPromises, "mkdir").mockImplementation(editDuringLookup as typeof makeDirectory);
  try {
    await mount.writeText("sales/child.json", "[]");
  } finally {
    lookup.mockRestore();
  }
  expect(edited).toBe(true);
  expect(ledger.dropEchoes([folder, child], options)).toEqual([folder]);
});
