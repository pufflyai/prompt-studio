import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createArtifactMount } from "./artifact-mount";

let tempDirs: string[] = [];

const createRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-artifact-mount-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("createArtifactMount", () => {
  test("reads, writes, lists, and deletes files under the mount root", async () => {
    const repoRoot = createRepo();
    const mount = createArtifactMount({ repoRoot, mountPath: ".pstdio/tickets" });

    await mount.writeText("PS-86/ticket.md", "ticket body");
    await mount.writeBytes("PS-86/blob.bin", new Uint8Array([1, 2, 3]));
    await mount.writeText("PS-87/ticket.md", "next ticket");

    expect(await mount.exists("PS-86/ticket.md")).toBe(true);
    expect(await mount.readText("PS-86/ticket.md")).toBe("ticket body");
    expect(Array.from(await mount.readBytes("PS-86/blob.bin"))).toEqual([1, 2, 3]);
    expect(await mount.list()).toEqual([
      { path: "PS-86/blob.bin", sizeBytes: 3 },
      { path: "PS-86/ticket.md", sizeBytes: 11 },
      { path: "PS-87/ticket.md", sizeBytes: 11 },
    ]);
    expect(await mount.listDirs()).toEqual(["PS-86", "PS-87"]);

    await mount.delete("PS-86/blob.bin");
    expect(await mount.exists("PS-86/blob.bin")).toBe(false);
  });

  test("rejects path escape attempts", async () => {
    const repoRoot = createRepo();
    const mount = createArtifactMount({ repoRoot, mountPath: ".pstdio/tickets" });

    await expect(mount.writeText("../outside.md", "nope")).rejects.toThrow("Artifact path escapes mount root");

    expect(existsSync(join(repoRoot, ".pstdio", "outside.md"))).toBe(false);
    expect(existsSync(join(repoRoot, "outside.md"))).toBe(false);
    expect(() => createArtifactMount({ repoRoot, mountPath: "../tickets" })).toThrow(
      "Artifact mount path must stay under .pstdio",
    );
  });

  test("deletes directories without touching siblings", async () => {
    const repoRoot = createRepo();
    const mount = createArtifactMount({ repoRoot, mountPath: ".pstdio/tickets" });

    await mount.writeText("PS-86/ticket.md", "ticket body");
    await mount.writeText("PS-87/ticket.md", "next ticket");

    await mount.delete("PS-86");

    expect(await mount.exists("PS-86/ticket.md")).toBe(false);
    expect(readFileSync(join(repoRoot, ".pstdio", "tickets", "PS-87", "ticket.md"), "utf8")).toBe("next ticket");
  });
});
