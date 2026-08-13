import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createArtifactMount, createFileMount } from "./artifact-mount";

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
  test("rejects mount root that escapes .pstdio/<namespace>", () => {
    expect(() => createArtifactMount({ repoRoot: "/repo", name: "planner", mountPath: "../escape" })).toThrow();
    expect(() => createArtifactMount({ repoRoot: "/repo", name: "planner", mountPath: "/abs" })).toThrow();
  });

  test("writes and reads text under .pstdio/<namespace>/<mount>", async () => {
    const repo = createTempDir();
    const mount = createArtifactMount({ repoRoot: repo, name: "planner", mountPath: "tickets" });

    await mount.writeText("PS-1/ticket.md", "# hello");
    const contents = await Bun.file(join(repo, ".pstdio/planner/tickets/PS-1/ticket.md")).text();
    expect(contents).toBe("# hello");
    expect(await mount.readText("PS-1/ticket.md")).toBe("# hello");
    expect(await mount.exists("PS-1/ticket.md")).toBe(true);
    expect(await mount.exists("missing.md")).toBe(false);
  });

  test("rejects path escaping mount root", async () => {
    const repo = createTempDir();
    const mount = createArtifactMount({ repoRoot: repo, name: "planner", mountPath: "tickets" });

    await expect(mount.writeText("../evil.md", "x")).rejects.toThrow(/escapes/);
    await expect(mount.writeText("/abs.md", "x")).rejects.toThrow(/escapes/);
  });

  test("lists files matching glob", async () => {
    const repo = createTempDir();
    const mount = createArtifactMount({ repoRoot: repo, name: "planner", mountPath: "tickets" });

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
    const mount = createArtifactMount({ repoRoot: repo, name: "planner", mountPath: "tickets" });

    await mount.writeText("a/foo.md", "");
    await mount.writeText("b/bar.md", "");
    await mount.writeText("top.md", "");

    expect(await mount.listDirs()).toEqual(["a", "b"]);
  });

  test("delete removes a file", async () => {
    const repo = createTempDir();
    const mount = createArtifactMount({ repoRoot: repo, name: "planner", mountPath: "tickets" });

    await mount.writeText("a.md", "a");
    await mount.delete("a.md");
    expect(await mount.exists("a.md")).toBe(false);
  });
});

describe("createFileMount", () => {
  test("round-trips files relative to the mount root", async () => {
    const root = createTempDir();
    const mount = createFileMount(root);

    await mount.writeText(".pstdio/tickets/PS-1/ticket.md", "# hello");
    expect(await mount.readText(".pstdio/tickets/PS-1/ticket.md")).toBe("# hello");
    expect(await mount.exists(".pstdio/tickets/PS-1/ticket.md")).toBe(true);

    expect((await mount.list("**/*.md")).map((f) => f.path)).toEqual([".pstdio/tickets/PS-1/ticket.md"]);

    await mount.delete(".pstdio/tickets/PS-1/ticket.md");
    expect(await mount.exists(".pstdio/tickets/PS-1/ticket.md")).toBe(false);
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
    symlinkSync(join(outside, "private"), join(root, "escape"), "dir");
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

    await mount.writeText(".pstdio/tickets/T-1/files/a.md", "a");
    await mount.writeText(".pstdio/tickets/T-1/files/nested/b.md", "b");
    await mount.writeText(".pstdio/tickets/T-2/files/c.md", "c");
    await mount.writeText("node_modules/pkg/index.js", "noise");

    expect((await mount.list(".pstdio/tickets/T-1/files/**")).map((f) => f.path)).toEqual([
      ".pstdio/tickets/T-1/files/a.md",
      ".pstdio/tickets/T-1/files/nested/b.md",
    ]);
    expect(await mount.list(".pstdio/tickets/T-9/files/**")).toEqual([]);
  });

  test("list rejects a pattern whose literal prefix escapes the mount root", async () => {
    const mount = createFileMount(createTempDir());

    await expect(mount.list("../../etc/**")).rejects.toThrow(/escapes/);
    await expect(mount.list("/etc/**")).rejects.toThrow(/escapes/);
  });
});
