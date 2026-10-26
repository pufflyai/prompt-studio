import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createArtifactMount, createFileMount, resolveArtifactMountRoot } from "./artifact-mount";

const tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-ext-mount-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

describe("createArtifactMount", () => {
  test.each([
    ".publishers",
    ".publishers/alice",
    ".publishers./alice",
    ".publishers /alice",
    ".PUBLISHERS/alice",
    "runs/../.Publishers/alice",
    ".publishers\\alice",
  ])("keeps the allocated-file namespace reserved for %s", (mountPath) => {
    expect(() => createArtifactMount({ repoRoot: "/repo", extensionId: "pstdio.tools", mountPath })).toThrow();
  });

  test("rejects mount root that escapes .pstdio/extension-storage/<publisher>.<name>", () => {
    expect(() =>
      createArtifactMount({ repoRoot: "/repo", extensionId: "pstdio.planner", mountPath: "../escape" }),
    ).toThrow();
    expect(() =>
      createArtifactMount({ repoRoot: "/repo", extensionId: "pstdio.planner", mountPath: "/abs" }),
    ).toThrow();
  });

  test("writes and reads text under .pstdio/extension-storage/<publisher>.<name>/<mount>", async () => {
    const repo = createTempDir();
    const mount = createArtifactMount({ repoRoot: repo, extensionId: "pstdio.planner", mountPath: "tickets" });

    await mount.writeText("PS-1/ticket.md", "# hello");
    const contents = await Bun.file(
      join(repo, ".pstdio/extension-storage/pstdio.planner/tickets/PS-1/ticket.md"),
    ).text();
    expect(contents).toBe("# hello");
    expect(await mount.readText("PS-1/ticket.md")).toBe("# hello");
    expect(await mount.exists("PS-1/ticket.md")).toBe(true);
    expect(await mount.exists("missing.md")).toBe(false);
  });

  test("reports each write, update, and delete at its path under the mount root", async () => {
    const repo = createTempDir();
    const written: string[] = [];
    const input = { repoRoot: repo, extensionId: "pstdio.dashboards", mountPath: "boards" };
    const mount = createArtifactMount({ ...input, onWrite: (path) => written.push(path) });
    const root = resolveArtifactMountRoot(input);

    await mount.writeText("sales/q3.json", "{}");
    await mount.updateText("sales/q3.json", "[]");
    await mount.writeBytes("logo.png", new Uint8Array([1]));
    await mount.readText("sales/q3.json");
    await mount.delete("sales");

    expect(root).toBe(join(repo, ".pstdio", "extension-storage", "pstdio.dashboards", "boards"));
    expect(written).toEqual([
      join(root, "sales", "q3.json"),
      join(root, "sales", "q3.json"),
      join(root, "logo.png"),
      join(root, "sales"),
    ]);
  });

  test("reports a write through a linked file at the file it changes", async () => {
    const repo = createTempDir();
    const written: string[] = [];
    const input = { repoRoot: repo, extensionId: "pstdio.dashboards", mountPath: "boards" };
    const mount = createArtifactMount({ ...input, onWrite: (path) => written.push(path) });
    const root = resolveArtifactMountRoot(input);
    await mount.writeText("sales/q3.json", "{}");
    symlinkSync(join(root, "sales", "q3.json"), join(root, "latest.json"));

    await mount.writeText("latest.json", "[]");
    await mount.updateText("latest.json", "[1]");

    expect(written.slice(1)).toEqual([join(root, "sales", "q3.json"), join(root, "sales", "q3.json")]);
  });

  test("reports a new file written through a linked folder at the folder it lands in", async () => {
    const repo = createTempDir();
    const written: string[] = [];
    const input = { repoRoot: repo, extensionId: "pstdio.dashboards", mountPath: "boards" };
    const mount = createArtifactMount({ ...input, onWrite: (path) => written.push(path) });
    const root = resolveArtifactMountRoot(input);
    await mount.writeText("sales/q3.json", "{}");
    symlinkSync(join(root, "sales"), join(root, "current"), "junction");

    await mount.writeText("current/q4.json", "{}");

    expect(written.at(-1)).toBe(join(root, "sales", "q4.json"));
  });

  test("rejects path escaping mount root", async () => {
    const repo = createTempDir();
    const mount = createArtifactMount({ repoRoot: repo, extensionId: "pstdio.planner", mountPath: "tickets" });

    await expect(mount.writeText("../evil.md", "x")).rejects.toThrow(/escapes/);
    await expect(mount.writeText("/abs.md", "x")).rejects.toThrow(/escapes/);
  });

  test("lists files matching glob", async () => {
    const repo = createTempDir();
    const mount = createArtifactMount({ repoRoot: repo, extensionId: "pstdio.planner", mountPath: "tickets" });

    await mount.writeText("a.md", "a");
    await mount.writeText("nested/b.md", "b");

    const all = await mount.list();
    expect(all.map((f) => f.path)).toEqual(["a.md", "nested/b.md"]);

    const onlyTopLevel = await mount.list("*.md");
    expect(onlyTopLevel.map((f) => f.path)).toEqual(["a.md"]);

    const everything = await mount.list("**/*.md");
    expect(everything.map((f) => f.path)).toEqual(["a.md", "nested/b.md"]);
  });

  test("listDirs returns immediate child directories", async () => {
    const repo = createTempDir();
    const mount = createArtifactMount({ repoRoot: repo, extensionId: "pstdio.planner", mountPath: "tickets" });

    await mount.writeText("a/foo.md", "");
    await mount.writeText("b/bar.md", "");
    await mount.writeText("top.md", "");

    expect(await mount.listDirs()).toEqual(["a", "b"]);
  });

  test("delete removes a file", async () => {
    const repo = createTempDir();
    const mount = createArtifactMount({ repoRoot: repo, extensionId: "pstdio.planner", mountPath: "tickets" });

    await mount.writeText("a.md", "a");
    await mount.delete("a.md");
    expect(await mount.exists("a.md")).toBe(false);
  });
});

describe("createFileMount", () => {
  test("updates existing text without recreating a deleted file", async () => {
    const mount = createFileMount(createTempDir());
    await mount.writeText("note.md", "long initial content");
    await mount.updateText("note.md", "short");
    expect(await mount.readText("note.md")).toBe("short");
    await mount.delete("note.md");
    await expect(mount.updateText("note.md", "stale draft")).rejects.toThrow();
    expect(await mount.exists("note.md")).toBe(false);
  });

  test("a concurrent delete cannot be undone by a text update", async () => {
    const mount = createFileMount(createTempDir());
    await mount.writeText("note.md", "initial");
    await Promise.allSettled([mount.updateText("note.md", "draft"), mount.delete("note.md")]);
    expect(await mount.exists("note.md")).toBe(false);
  });

  test("round-trips files relative to the mount root", async () => {
    const root = createTempDir();
    const mount = createFileMount(root);

    await mount.writeText(".pstdio/extension-storage/pstdio-planner/tickets/PS-1/ticket.md", "# hello");
    expect(await mount.readText(".pstdio/extension-storage/pstdio-planner/tickets/PS-1/ticket.md")).toBe("# hello");
    expect(await mount.exists(".pstdio/extension-storage/pstdio-planner/tickets/PS-1/ticket.md")).toBe(true);

    expect((await mount.list("**/*.md")).map((f) => f.path)).toEqual([
      ".pstdio/extension-storage/pstdio-planner/tickets/PS-1/ticket.md",
    ]);

    await mount.delete(".pstdio/extension-storage/pstdio-planner/tickets/PS-1/ticket.md");
    expect(await mount.exists(".pstdio/extension-storage/pstdio-planner/tickets/PS-1/ticket.md")).toBe(false);
  });

  test("rejects paths escaping the mount root", async () => {
    const mount = createFileMount(createTempDir());

    await expect(mount.writeText("../evil.md", "x")).rejects.toThrow(/escapes/);
    await expect(mount.writeText("/abs.md", "x")).rejects.toThrow(/escapes/);
    await expect(mount.writeText("C:/evil.md", "x")).rejects.toThrow(/escapes/);
    await expect(mount.writeText("nested\\evil.md", "x")).rejects.toThrow(/escapes/);
  });

  test("rejects existing symlinks that leave the mount root", async () => {
    const root = createTempDir();
    const outside = createTempDir();
    mkdirSync(join(outside, "private"), { recursive: true });
    writeFileSync(join(outside, "private/secret.txt"), "secret");
    try {
      // "junction" resolves through realpath like a symlink but, unlike a "dir"
      // symlink, doesn't need elevated privileges on Windows.
      symlinkSync(join(outside, "private"), join(root, "escape"), "junction");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    const mount = createFileMount(root);

    await expect(mount.readText("escape/secret.txt")).rejects.toThrow(/escapes/);
    await expect(mount.writeText("escape/secret.txt", "changed")).rejects.toThrow(/escapes/);
    await expect(mount.list("escape/**")).rejects.toThrow(/escapes/);
    await expect(mount.listDirs("escape")).rejects.toThrow(/escapes/);
    expect(await Bun.file(join(outside, "private/secret.txt")).text()).toBe("secret");
  });

  test("scopes the walk to a pattern's literal directory prefix", async () => {
    const root = createTempDir();
    const mount = createFileMount(root);

    await mount.writeText(".pstdio/extension-storage/pstdio-planner/tickets/T-1/files/a.md", "a");
    await mount.writeText(".pstdio/extension-storage/pstdio-planner/tickets/T-1/files/nested/b.md", "b");
    await mount.writeText(".pstdio/extension-storage/pstdio-planner/tickets/T-2/files/c.md", "c");
    await mount.writeText("node_modules/pkg/index.js", "noise");

    expect(
      (await mount.list(".pstdio/extension-storage/pstdio-planner/tickets/T-1/files/**")).map((f) => f.path),
    ).toEqual([
      ".pstdio/extension-storage/pstdio-planner/tickets/T-1/files/a.md",
      ".pstdio/extension-storage/pstdio-planner/tickets/T-1/files/nested/b.md",
    ]);
    expect(await mount.list(".pstdio/extension-storage/pstdio-planner/tickets/T-9/files/**")).toEqual([]);
  });

  test("list rejects a pattern whose literal prefix escapes the mount root", async () => {
    const mount = createFileMount(createTempDir());

    await expect(mount.list("../../etc/**")).rejects.toThrow(/escapes/);
    await expect(mount.list("/etc/**")).rejects.toThrow(/escapes/);
  });
});

test("memory files follow the same globs, directories, and metadata as a real mount", async () => {
  const { createMemoryRepoFiles } = await import("@pstdio/sdk/testing");
  const real = createFileMount(createTempDir());
  const memory = createMemoryRepoFiles();
  for (const mount of [real, memory]) {
    await mount.writeText(".folders/one/title.txt", "One");
    await mount.writeText(".folders/two/title.txt", "Two");
    await mount.writeText(".folders/one/nested/title.txt", "Nested");
    await mount.writeText(".folders/one/note.md", "Note");
  }
  for (const pattern of [undefined, ".folders/*/title.txt", "**/title.txt", ".folders/**", "*.txt"]) {
    const diskFiles = await real.list(pattern);
    const fakeFiles = await memory.list(pattern);
    expect(fakeFiles.map(({ path, size }) => ({ path, size }))).toEqual(
      diskFiles.map(({ path, size }) => ({ path, size })),
    );
    for (const file of fakeFiles) expect(Number.isFinite(Date.parse(file.updatedAt!))).toBe(true);
  }
  expect(await memory.listDirs()).toEqual(await real.listDirs());
  expect(await memory.listDirs(".folders")).toEqual(await real.listDirs(".folders"));
  await real.delete(".folders/one");
  await memory.delete(".folders/one");
  expect(await memory.listDirs(".folders")).toEqual(await real.listDirs(".folders"));
});
