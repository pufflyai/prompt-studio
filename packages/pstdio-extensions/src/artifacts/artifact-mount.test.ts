import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createArtifactMount } from "./artifact-mount";

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
    expect(() => createArtifactMount({ repoRoot: "/repo", namespace: "planner", mountPath: "../escape" })).toThrow();
    expect(() => createArtifactMount({ repoRoot: "/repo", namespace: "planner", mountPath: "/abs" })).toThrow();
  });

  test("writes and reads text under .pstdio/<namespace>/<mount>", async () => {
    const repo = createTempDir();
    const mount = createArtifactMount({ repoRoot: repo, namespace: "planner", mountPath: "tickets" });

    await mount.writeText("PS-1/ticket.md", "# hello");
    const contents = await Bun.file(join(repo, ".pstdio/planner/tickets/PS-1/ticket.md")).text();
    expect(contents).toBe("# hello");
    expect(await mount.readText("PS-1/ticket.md")).toBe("# hello");
    expect(await mount.exists("PS-1/ticket.md")).toBe(true);
    expect(await mount.exists("missing.md")).toBe(false);
  });

  test("rejects path escaping mount root", async () => {
    const repo = createTempDir();
    const mount = createArtifactMount({ repoRoot: repo, namespace: "planner", mountPath: "tickets" });

    await expect(mount.writeText("../evil.md", "x")).rejects.toThrow(/escapes/);
    await expect(mount.writeText("/abs.md", "x")).rejects.toThrow(/escapes/);
  });

  test("lists files matching glob", async () => {
    const repo = createTempDir();
    const mount = createArtifactMount({ repoRoot: repo, namespace: "planner", mountPath: "tickets" });

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
    const mount = createArtifactMount({ repoRoot: repo, namespace: "planner", mountPath: "tickets" });

    await mount.writeText("a/foo.md", "");
    await mount.writeText("b/bar.md", "");
    await mount.writeText("top.md", "");

    expect(await mount.listDirs()).toEqual(["a", "b"]);
  });

  test("delete removes a file", async () => {
    const repo = createTempDir();
    const mount = createArtifactMount({ repoRoot: repo, namespace: "planner", mountPath: "tickets" });

    await mount.writeText("a.md", "a");
    await mount.delete("a.md");
    expect(await mount.exists("a.md")).toBe(false);
  });
});
