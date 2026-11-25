import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, renameSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import * as fsPromises from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { createArtifactMount, resolveArtifactMountRoot } from "pstdio-extensions";
import { createArtifactMountWriteLedger } from "./write-ledger";

const roots: string[] = [];
const createMount = (ledger: ReturnType<typeof createArtifactMountWriteLedger>) => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-mount-ledger-"));
  roots.push(repoRoot);
  const location = { repoRoot, extensionId: "pstdio.dashboards", mountPath: "boards" };
  const root = resolveArtifactMountRoot(location);
  return {
    mount: createArtifactMount({ ...location, onWrite: ledger.record }),
    root,
  };
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test.each([
  [true, true],
  [false, true],
  [true, false],
  [false, false],
])("reports nested edits (owned subtree: %s, API write after report: %s)", async (ownedSubtree, apiWrite) => {
  const ledger = createArtifactMountWriteLedger(() => 0);
  const { mount, root } = createMount(ledger);
  const observer = ledger.createEchoFilter();
  const folder = join(root, "sales");
  const archive = join(folder, "archive");
  const nested = join(archive, "2026", "note.json");
  const options = { keepMatchedWrites: true };
  await mount.writeText("sales/archive/first.json", "{}");
  if (ownedSubtree) await mount.writeText("sales/archive/2026/note.json", "{}");
  else {
    mkdirSync(dirname(nested));
    writeFileSync(nested, "{}");
  }
  writeFileSync(join(archive, "external.json"), "outside");
  expect(observer([archive], options)).toEqual([archive]);

  writeFileSync(nested, "a new outside edit inside a nested directory");
  if (apiWrite) await mount.writeText("sales/archive/owned.json", "{}");
  expect(observer([folder], options)).toEqual([folder]);
});

describe("artifact mount write ledger", () => {
  test("drops paths in the state a mount write left, and the folders it created", async () => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);

    await mount.writeText("sales/q3.json", "{}");
    await mount.writeText("sales/q3.json", "[]");

    expect(ledger.dropEchoes([join(root, "sales"), join(root, "sales", "q3.json")])).toEqual([]);
  });

  test("keeps a later direct edit of a file the mount wrote", async () => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const path = join(root, "q3.json");

    await mount.writeText("q3.json", "{}");
    writeFileSync(path, '{"total":1}');

    expect(ledger.dropEchoes([path])).toEqual([path]);
  });

  test("keeps a direct edit that leaves the same size but a new modification time", async () => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const path = join(root, "q3.json");

    await mount.writeText("q3.json", "{}");
    writeFileSync(path, "[]");
    utimesSync(path, new Date(), new Date(Date.now() + 5_000));

    expect(ledger.dropEchoes([path])).toEqual([path]);
  });

  test.each([true, false])("filters owned folder echoes independently of batch order (%s)", async (fileFirst) => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const path = join(folder, "q3.json");
    await mount.writeText("sales/q3.json", "{}");
    writeFileSync(path, '{"total":1}');
    const options = { keepMatchedWrites: true };
    expect(ledger.dropEchoes(fileFirst ? [path, folder] : [folder, path], options)).toEqual([path]);
    expect(ledger.dropEchoes([folder], options)).toEqual([]);

    writeFileSync(path, '{"total":20}');
    expect(ledger.dropEchoes([folder], options)).toEqual([folder]);

    await mount.writeText("sales/q3.json", "{}");
    expect(ledger.dropEchoes([path, folder], options)).toEqual([]);
  });
});

describe("artifact mount directory echoes", () => {
  test.each([
    [false, false],
    [false, true],
    [true, false],
  ])("advances a reported folder across API writes (outside creation: %s, intervening edit: %s)", async (outsideCreation, outsideWrite) => {
    const ledger = createArtifactMountWriteLedger(() => 0);
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const archive = join(folder, "archive");
    const options = { keepMatchedWrites: true };
    const first = ledger.createEchoFilter();
    const second = ledger.createEchoFilter();
    await mount.writeText("sales/first.json", "{}");
    if (outsideCreation) mkdirSync(archive);
    else await mount.writeText("sales/archive/first.json", "{}");

    writeFileSync(join(archive, "external.json"), "outside");
    expect(first([archive], options)).toEqual([archive]);
    if (outsideWrite) writeFileSync(join(archive, "another.json"), "another outside change");

    await mount.writeText("sales/archive/second.json", "{}");
    await mount.writeText("sales/archive/third.json", "{}");
    expect(first([folder], options)).toEqual(outsideCreation || outsideWrite ? [folder] : []);
    expect(second([folder], options)).toEqual([folder]);
    if (!outsideCreation && !outsideWrite) {
      await mount.delete("sales/archive/second.json");
      expect(first([folder], options)).toEqual([]);
    }
  });

  test.each([true, false])("reports a replaced folder and missing child in either order (%s)", async (fileFirst) => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const path = join(folder, "q3.json");
    const replacement = join(root, "incoming");
    mkdirSync(replacement, { recursive: true });
    writeFileSync(join(replacement, "q4.json"), "{}");

    await mount.writeText("sales/q3.json", "{}");
    renameSync(folder, join(root, "previous"));
    renameSync(replacement, folder);
    await mount.writeText("sales/q5.json", "{}");

    const paths = fileFirst ? [path, folder] : [folder, path];
    expect(ledger.dropEchoes(paths, { keepMatchedWrites: true })).toEqual(paths);
  });

  test.each([
    true,
    false,
  ])("reports direct edits after a previously observed folder is moved back (%s)", async (keep) => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const file = join(folder, "q3.json");
    const outside = join(dirname(root), "external-sales");
    const options = { keepMatchedWrites: keep };
    await mount.writeText("sales/q3.json", "{}");
    expect(ledger.dropEchoes([folder, file], options)).toEqual([]);

    renameSync(folder, outside);
    writeFileSync(join(outside, "q4.json"), "{}");
    utimesSync(outside, new Date(), new Date(Date.now() + 5_000));
    renameSync(outside, folder);
    await mount.writeText("sales/q5.json", "{}");
    expect(ledger.dropEchoes([folder, join(folder, "q5.json")], options)).toEqual([folder]);
  });

  test("a delayed directory echo still matches after another owned child is written", async () => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/first.json", "{}");
    expect(ledger.dropEchoes([folder, join(folder, "first.json")], options)).toEqual([]);

    await mount.writeText("sales/second.json", "[]");
    expect(ledger.dropEchoes([folder, join(folder, "second.json")], options)).toEqual([]);
  });

  test("a delayed ancestor echo still matches after an owned subfolder is created", async () => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const archive = join(folder, "archive");
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/first.json", "{}");
    expect(ledger.dropEchoes([folder, join(folder, "first.json")], options)).toEqual([]);

    await mount.writeText("sales/archive/second.json", "[]");
    expect(ledger.dropEchoes([folder, archive, join(archive, "second.json")], options)).toEqual([]);
  });

  test("reports a parent edit made while the newly created child is checked", async () => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const archive = join(folder, "archive");
    const outside = join(dirname(root), "external-sales");
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/first.json", "{}");
    expect(ledger.dropEchoes([folder, join(folder, "first.json")], options)).toEqual([]);

    const realpath = fsPromises.realpath;
    let edited = false;
    const editDuringLookup = async (...args: Parameters<typeof realpath>) => {
      const result: string | Buffer = await Reflect.apply(realpath, fsPromises, args);
      if (!edited && basename(String(args[0])) === "archive") {
        edited = true;
        renameSync(folder, outside);
        writeFileSync(join(outside, "external.json"), "{}");
        utimesSync(outside, new Date(), new Date(Date.now() + 5_000));
        renameSync(outside, folder);
      }
      return result;
    };
    const lookup = spyOn(fsPromises, "realpath").mockImplementation(editDuringLookup as typeof realpath);
    try {
      await mount.writeText("sales/archive/second.json", "[]");
    } finally {
      lookup.mockRestore();
    }
    expect(edited).toBe(true);
    expect(ledger.dropEchoes([folder, archive, join(archive, "second.json")], options)).toEqual([folder]);
  });
});

describe("artifact mount deletions and expiry", () => {
  test("drops everything a mount delete removed", async () => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    await mount.writeText("note-1/content.md", "# A");
    await mount.writeText("note-1/title.txt", "A");
    ledger.dropEchoes([join(root, "note-1", "content.md"), join(root, "note-1", "title.txt")]);

    await mount.delete("note-1");

    const removed = [join(root, "note-1"), join(root, "note-1", "content.md"), join(root, "note-1", "title.txt")];
    expect(ledger.dropEchoes(removed)).toEqual([]);
  });

  test("forgets a write after its echo was dropped", async () => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const path = join(root, "q3.json");

    await mount.writeText("q3.json", "{}");
    expect(ledger.dropEchoes([path])).toEqual([]);
    expect(ledger.dropEchoes([path])).toEqual([path]);
  });

  test.each(["q3.json", "sales"])("reports a new direct deletion after %s reappears", async (deletedPath) => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const file = deletedPath === "sales" ? "sales/q3.json" : deletedPath;
    const path = join(root, file);
    const options = { keepMatchedWrites: true };
    await mount.writeText(file, "{}");
    ledger.dropEchoes([path]);
    await mount.delete(deletedPath);
    expect(ledger.dropEchoes([path], options)).toEqual([]);

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "[]");
    expect(ledger.dropEchoes([path], options)).toEqual([path]);
    rmSync(path);
    expect(ledger.dropEchoes([path], options)).toEqual([path]);
  });

  test("keeps a delayed directory deletion echo for a sibling that never returned", async () => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const oldPath = join(root, "sales/old.json");
    const newPath = join(root, "sales/new.json");
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/old.json", "{}");
    ledger.dropEchoes([oldPath]);
    await mount.delete("sales");
    expect(ledger.dropEchoes([oldPath], options)).toEqual([]);

    await mount.writeText("sales/new.json", "[]");
    expect(ledger.dropEchoes([join(root, "sales"), newPath, oldPath], options)).toEqual([]);
    rmSync(newPath);
    expect(ledger.dropEchoes([newPath, oldPath], options)).toEqual([newPath]);
  });

  test.each([
    "folder",
    "child",
    "deletion",
  ] as const)("reports an external directory's child deletion with a %s hint", async (hint) => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const outside = join(dirname(root), "external-sales");
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/old.json", "{}");
    await mount.delete("sales");
    expect(ledger.dropEchoes([folder, join(folder, "old.json")], options)).toEqual([]);

    mkdirSync(outside);
    writeFileSync(join(outside, "new.json"), "{}");
    writeFileSync(join(outside, "other.json"), "[]");
    renameSync(outside, folder);
    if (hint !== "deletion") {
      const notified = hint === "folder" ? folder : join(folder, "other.json");
      expect(ledger.dropEchoes([notified], options)).toEqual([notified]);
    }

    const removed = join(folder, "new.json");
    rmSync(removed);
    expect(ledger.dropEchoes([removed], options)).toEqual([removed]);
  });

  test("forgets writes after the echo window", async () => {
    let now = 0;
    const ledger = createArtifactMountWriteLedger(() => now);
    const { mount, root } = createMount(ledger);
    const path = join(root, "q3.json");

    await mount.writeText("q3.json", "{}");
    now = 5_001;

    expect(ledger.dropEchoes([path])).toEqual([path]);
  });

  test("treats a path below a folder that became a file as removed", async () => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    await mount.writeText("drafts/x.md", "x");

    rmSync(join(root, "drafts"), { recursive: true });
    writeFileSync(join(root, "drafts"), "now a file");

    expect(ledger.dropEchoes([join(root, "drafts", "x.md")])).toEqual([join(root, "drafts", "x.md")]);
  });
});

describe("artifact mount folder-only notifications", () => {
  test("an owned nested write advances only the watcher that reported the folder", async () => {
    const ledger = createArtifactMountWriteLedger(() => 0);
    const { mount, root } = createMount(ledger);
    const observer = ledger.createEchoFilter();
    const unnotified = ledger.createEchoFilter();
    const folder = join(root, "sales");
    const archive = join(folder, "archive");
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/archive/first.json", "{}");
    expect(observer([folder, archive], options)).toEqual([]);

    writeFileSync(join(archive, "external.json"), "[]");
    utimesSync(archive, new Date(), new Date(Date.now() + 5_000));
    expect(observer([archive], options)).toEqual([archive]);
    await mount.writeText("sales/archive/owned.json", "{}");

    expect(observer([folder], options)).toEqual([]);
    expect(unnotified([folder], options)).toEqual([folder]);
  });

  test.each([
    true,
    false,
  ])("reports an external child added during an owned nested write (previous report: %s)", async (reported) => {
    const ledger = createArtifactMountWriteLedger(() => 0);
    const { mount, root } = createMount(ledger);
    const observer = ledger.createEchoFilter();
    const folder = join(root, "sales");
    const archive = join(folder, "archive");
    const external = join(archive, "new-external.json");
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/archive/first.json", "{}");
    expect(observer([folder, archive], options)).toEqual([]);
    if (reported) {
      writeFileSync(join(archive, "already-reported.json"), "[]");
      expect(observer([archive], options)).toEqual([archive]);
    }

    const write = fsPromises.writeFile;
    const duringWrite = spyOn(fsPromises, "writeFile").mockImplementation(async (...args) => {
      if (typeof args[0] === "string" && basename(args[0]) === "owned.json") writeFileSync(external, "[]");
      return write(...args);
    });
    try {
      await mount.writeText("sales/archive/owned.json", "{}");
    } finally {
      duringWrite.mockRestore();
    }

    expect(await mount.exists("sales/archive/new-external.json")).toBe(true);
    expect(observer([folder], options)).toEqual([folder]);
  });

  test("retires external folder returns on a single watch before the old echo is observed", async () => {
    const ledger = createArtifactMountWriteLedger(() => 0);
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const child = join(folder, "old.json");
    await mount.writeText("sales/old.json", "{}");
    await mount.delete("sales");

    mkdirSync(folder);
    writeFileSync(child, "[]");
    expect(ledger.dropEchoes([folder])).toEqual([folder]);
    rmSync(child);
    expect(ledger.dropEchoes([child])).toEqual([child]);
  });

  test("a consumed single-watch folder echo does not make an owned subtree external", async () => {
    const ledger = createArtifactMountWriteLedger(() => 0);
    const { mount, root } = createMount(ledger);
    const nested = join(root, "sales", "nested");
    const oldChild = join(nested, "old.json");
    await mount.writeText("sales/nested/old.json", "{}");
    await mount.delete("sales");
    await mount.writeText("sales/nested/new.json", "[]");

    expect(ledger.dropEchoes([nested])).toEqual([]);
    expect(ledger.dropEchoes([oldChild])).toEqual([]);
  });

  test.each([
    "new",
    "replacement",
  ])("reports a folder-only hint when an outside %s sibling arrives inside an owned create", async (kind) => {
    const ledger = createArtifactMountWriteLedger(() => 0);
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const child = join(folder, "owned.json");
    const outside = kind === "new" ? join(folder, "outside.json") : join(folder, "first.json");
    const replacement = join(dirname(root), "replacement.json");
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/first.json", "{}");
    expect(ledger.dropEchoes([folder], options)).toEqual([]);

    const writeFile = fsPromises.writeFile;
    const physicalChild = join(await fsPromises.realpath(folder), "owned.json");
    let edited = false;
    const editDuringWrite = async (...args: Parameters<typeof writeFile>) => {
      if (args[0] === physicalChild) {
        edited = true;
        writeFileSync(replacement, "[]");
        renameSync(replacement, outside);
      }
      return Reflect.apply(writeFile, fsPromises, args);
    };
    const write = spyOn(fsPromises, "writeFile").mockImplementation(editDuringWrite as typeof writeFile);
    try {
      await mount.writeText("sales/owned.json", "{}");
    } finally {
      write.mockRestore();
    }
    expect(edited).toBe(true);
    expect(ledger.dropEchoes([folder, child], options)).toEqual([folder]);
  });
});

test.each(["folder", "child"])("reports removals after an originally owned subtree returns (%s hint)", async (hint) => {
  const ledger = createArtifactMountWriteLedger(() => 0);
  const { mount, root } = createMount(ledger);
  const folder = join(root, "sales");
  const nested = join(folder, "nested");
  const parked = join(dirname(root), "parked-nested");
  const returned = hint === "folder" ? nested : join(nested, "a.json");
  const removed = join(nested, "b.json");
  const options = { keepMatchedWrites: true };
  await mount.writeText("sales/nested/a.json", "{}");
  await mount.writeText("sales/nested/b.json", "{}");
  renameSync(nested, parked);
  await mount.delete("sales");
  expect(ledger.dropEchoes([folder], options)).toEqual([]);
  await mount.writeText("sales/owned.json", "{}");

  renameSync(parked, nested);
  expect(ledger.dropEchoes([returned], options)).toEqual([returned]);
  rmSync(removed);
  expect(ledger.dropEchoes([removed], options)).toEqual([removed]);
});

describe("artifact mount restored folder batches", () => {
  test.each([
    ["folder", true],
    ["child", true],
    ["folder", false],
    ["child", false],
  ])("reports an external subtree from a %s hint (dual watch: %s)", async (hintKind, keepMatchedWrites) => {
    const ledger = createArtifactMountWriteLedger(() => 0);
    const { mount, root } = createMount(ledger);
    const missing = join(root, "sales", "old.json");
    await mount.writeText("sales/old.json", "{}");
    await mount.delete("sales");
    await mount.writeText("sales/owned.json", "[]");

    const folder = join(root, "sales", "returned");
    const child = join(folder, "nested", "child.json");
    mkdirSync(dirname(child), { recursive: true });
    writeFileSync(child, "external");
    const hint = hintKind === "folder" ? folder : join(folder, "still-present.json");
    if (hintKind === "child") writeFileSync(hint, "a separate file");
    const options = { keepMatchedWrites };
    expect(ledger.dropEchoes([hint], options)).toEqual([hint]);

    rmSync(child);
    expect(ledger.dropEchoes([child, missing], options)).toEqual([child]);
  });

  test("a newer file keeps reporting outside removals after its write proof was consumed", async () => {
    const ledger = createArtifactMountWriteLedger(() => 0);
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const child = join(folder, "new.json");
    const outside = join(dirname(root), "returned-sales");
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/old.json", "{}");
    await mount.delete("sales");
    await mount.writeText("sales/new.json", "[]");
    rmSync(child);
    expect(ledger.dropEchoes([child], options)).toEqual([child]);

    renameSync(folder, outside);
    writeFileSync(join(outside, "new.json"), "returned");
    utimesSync(outside, new Date(), new Date(Date.now() + 5_000));
    renameSync(outside, folder);
    expect(ledger.dropEchoes([folder], options)).toEqual([folder]);
    rmSync(child);
    expect(ledger.dropEchoes([child], options)).toEqual([child]);
  });

  test.each([
    "sales",
    "sales/archive",
  ])("reports an outside removal of a directory created after deleting %s", async (deletedPath) => {
    const ledger = createArtifactMountWriteLedger(() => 0);
    const { mount, root } = createMount(ledger);
    await mount.writeText("sales/archive/old.json", "{}");
    await mount.delete(deletedPath);
    await mount.writeText("sales/archive/new.json", "[]");
    const folder = join(root, "sales", "archive");
    rmSync(folder, { recursive: true });

    expect(ledger.dropEchoes([folder], { keepMatchedWrites: true })).toEqual([folder]);
  });

  test("reports an outside deletion of a file written after an owned folder restore", async () => {
    const ledger = createArtifactMountWriteLedger(() => 0);
    const { mount, root } = createMount(ledger);
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/old.json", "{}");
    await mount.delete("sales");
    await mount.writeText("sales/new.json", "[]");
    const child = join(root, "sales", "new.json");
    rmSync(child);

    expect(ledger.dropEchoes([child], options)).toEqual([child]);
  });

  test("a replacement folder hint retires returned child deletions and keeps missing sibling echoes", async () => {
    const ledger = createArtifactMountWriteLedger(() => 0);
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const child = join(folder, "q3.json");
    const missingSibling = join(folder, "old.json");
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/q3.json", "{}");
    await mount.writeText("sales/old.json", "{}");
    await mount.delete("sales/q3.json");
    await mount.delete("sales/old.json");
    expect(ledger.dropEchoes([child, missingSibling], options)).toEqual([]);

    const replacement = join(dirname(root), "replacement-sales");
    mkdirSync(replacement);
    writeFileSync(join(replacement, "q3.json"), "[]");
    renameSync(folder, join(dirname(root), "previous-sales"));
    renameSync(replacement, folder);
    expect(ledger.dropEchoes([folder], options)).toEqual([folder]);
    rmSync(child);
    expect(ledger.dropEchoes([child, missingSibling], options)).toEqual([child]);
  });

  test("retires prior file deletions when a restored folder is the only return hint", async () => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const child = join(folder, "q3.json");
    const outside = join(dirname(root), "restored-sales");
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/q3.json", "{}");
    await mount.delete("sales/q3.json");
    await mount.delete("sales");
    expect(ledger.dropEchoes([folder, child], options)).toEqual([]);

    mkdirSync(outside);
    writeFileSync(join(outside, "q3.json"), "[]");
    renameSync(outside, folder);
    expect(ledger.dropEchoes([folder], options)).toEqual([folder]);
    rmSync(child);
    expect(ledger.dropEchoes([child], options)).toEqual([child]);
  });

  test("keeps a new mount delete after an external folder return", async () => {
    const ledger = createArtifactMountWriteLedger(() => 0);
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const earlier = join(folder, "earlier.json");
    const latest = join(folder, "latest.json");
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/earlier.json", "{}");
    await mount.delete("sales/earlier.json");
    await mount.delete("sales");

    mkdirSync(folder);
    writeFileSync(earlier, "[]");
    writeFileSync(latest, "[]");
    await mount.delete("sales/latest.json");
    expect(ledger.dropEchoes([folder, latest], options)).toEqual([folder]);
    expect(ledger.dropEchoes([latest], options)).toEqual([]);

    rmSync(earlier);
    expect(ledger.dropEchoes([earlier], options)).toEqual([earlier]);
  });

  test.each([
    true,
    false,
  ])("keeps a missing sibling's owned deletion echo after an external sibling is added (%s)", async (folderFirst) => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const oldPath = join(folder, "old.json");
    const newPath = join(folder, "new.json");
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/old.json", "{}");
    ledger.dropEchoes([folder, oldPath], options);
    await mount.delete("sales");
    expect(ledger.dropEchoes([folder, oldPath], options)).toEqual([]);
    await mount.writeText("sales/new.json", "{}");
    expect(ledger.dropEchoes([folder, newPath], options)).toEqual([]);

    writeFileSync(join(folder, "external.json"), "[]");
    const paths = folderFirst ? [folder, oldPath] : [oldPath, folder];
    expect(ledger.dropEchoes(paths, options)).toEqual([folder]);
    expect(ledger.dropEchoes([oldPath], options)).toEqual([]);
  });

  test.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])("reports child deletions after a folder returns (folder first: %s, separate burst: %s)", async (folderFirst, separateBurst) => {
    const ledger = createArtifactMountWriteLedger();
    const { mount, root } = createMount(ledger);
    const folder = join(root, "sales");
    const child = join(folder, "q3.json");
    const outside = join(dirname(root), "restored-sales");
    const options = { keepMatchedWrites: true };
    await mount.writeText("sales/q3.json", "{}");
    ledger.dropEchoes([folder, child], options);
    await mount.delete("sales");
    expect(ledger.dropEchoes([folder, child], options)).toEqual([]);

    mkdirSync(outside);
    writeFileSync(join(outside, "q3.json"), "[]");
    renameSync(outside, folder);
    if (separateBurst) expect(ledger.dropEchoes([folder], options)).toEqual([folder]);
    rmSync(child);
    const paths = folderFirst ? [folder, child] : [child, folder];
    expect(ledger.dropEchoes(paths, options)).toEqual(paths);
  });
});
