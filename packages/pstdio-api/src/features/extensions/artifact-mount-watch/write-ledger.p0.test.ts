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
    expect(ledger.dropEchoes(fileFirst ? [path, folder] : [folder, path], { keepMatchedWrites: true })).toEqual([path]);
  });
});

describe("artifact mount directory echoes", () => {
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
