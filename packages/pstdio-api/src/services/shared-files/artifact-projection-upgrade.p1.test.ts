import { expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { artifactFilesFixture } from "./artifact-files.fixture";
import { upgradeArtifactFileProjections } from "./artifact-projection-upgrade";
import { artifactProjectionKey, fileProjection, projectionAddress } from "./file-state";

test("startup imports only its recorded workspace contexts and preserves newer indexed facts on retry", async () => {
  const f = await artifactFilesFixture();
  try {
    const key = artifactProjectionKey(f.owner, f.input.repoRoot);
    const address = projectionAddress(key);
    const other = projectionAddress(
      artifactProjectionKey({ ...f.owner, workbenchId: "another-project" }, f.input.repoRoot),
    );
    const old = { "documents/note.md": { node: null, hash: null, revision: "old" } };
    const current = { "documents/note.md": { node: null, hash: null, revision: "new" } };
    await mkdir(dirname(address.path), { recursive: true });
    await Bun.write(address.path, JSON.stringify(old));
    await Bun.write(other.path, JSON.stringify(old));
    const input = {
      projections: f.deps.extensionStorageService.fileProjections,
      contexts: [{ owner: f.owner, repoRoot: f.input.repoRoot }],
    };
    await upgradeArtifactFileProjections(input);
    expect(await Bun.file(address.path).exists()).toBe(false);
    expect(await Bun.file(other.path).exists()).toBe(true);
    const root = input.projections.open(address.key);
    expect((await root.read()).state).toEqual(old);
    await root.write(current);
    await Bun.write(address.path, JSON.stringify(old));
    await upgradeArtifactFileProjections(input);
    expect((await root.read()).state).toEqual(current);
    expect(await Bun.file(address.path).exists()).toBe(false);
  } finally {
    await f.close();
  }
});

test("a failed startup import keeps its original and requests do not retry or overwrite it", async () => {
  const f = await artifactFilesFixture();
  try {
    const key = artifactProjectionKey(f.owner, f.input.repoRoot);
    const address = projectionAddress(key);
    await mkdir(dirname(address.path), { recursive: true });
    await Bun.write(address.path, "invalid JSON");
    const failures: unknown[] = [];
    await upgradeArtifactFileProjections({
      projections: f.deps.extensionStorageService.fileProjections,
      contexts: [{ owner: f.owner, repoRoot: f.input.repoRoot }],
      failed: (error) => {
        failures.push(error);
      },
    });
    const projection = fileProjection(key, f.deps.extensionStorageService.fileProjections);
    for (let attempt = 0; attempt < 2; attempt++)
      await expect(projection.read(["documents/note.md"])).rejects.toThrow("startup");
    expect(failures).toHaveLength(1);
    expect(await Bun.file(address.path).text()).toBe("invalid JSON");
    expect((await f.deps.extensionStorageService.fileProjections.open(address.key).read()).initialized).toBe(false);
  } finally {
    await f.close();
  }
});
