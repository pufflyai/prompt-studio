import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createArtifactMount, resolveArtifactMountRoot } from "pstdio-extensions";
import { createArtifactMountWriteLedger } from "./write-ledger";

const roots: string[] = [];
const createMount = (ledger: ReturnType<typeof createArtifactMountWriteLedger>) => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-mount-ledger-"));
  roots.push(repoRoot);
  const location = { repoRoot, extensionId: "pstdio.dashboards", mountPath: "boards" };
  return {
    mount: createArtifactMount({ ...location, onWrite: ledger.record }),
    root: resolveArtifactMountRoot(location),
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
