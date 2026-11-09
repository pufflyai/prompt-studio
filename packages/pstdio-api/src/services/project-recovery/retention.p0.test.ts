import { afterEach, test as baseTest, expect } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { captureRecoveryFolder } from "./capture";
import { createRecoveryChunkStore } from "./chunks";
import { readRecoveryManifest } from "./manifest";
import { nativeRecoverySupported } from "./native-recovery.fixture";
import { pruneRecoveryStore } from "./retention";
import { prepareRecoveryCapture } from "./transfer";
import { verifyRecoveryCapture } from "./verify-capture";

const test = baseTest.skipIf(!nativeRecoverySupported);

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

test("local retention keeps every current capture graph and removes only superseded ciphertext", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-retention-"));
  roots.push(root);
  const folder = join(root, "project");
  await mkdir(folder);
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "account",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const chunks = await createRecoveryChunkStore({ root: join(root, "recovery"), space });
  const source = { id: "workspace", deviceId: "device", name: "Laptop", folder };
  const capture = async () =>
    prepareRecoveryCapture({ chunks, source, capture: await captureRecoveryFolder({ root: folder, chunks }) });
  await writeFile(join(folder, "kept"), "unchanged bytes");
  await writeFile(join(folder, "replaced"), "superseded bytes");
  const previous = await capture();
  await writeFile(join(folder, "replaced"), "current bytes");
  // Recently written files are never reused, so let both age past the racy window.
  await Bun.sleep(2_100);
  const current = await capture();
  const before = await readdir(chunks.directory);

  await expect(
    pruneRecoveryStore({ chunks, roots: [current, { ...previous, blobId: "BBBBBBBBBBBBBBBBBBBBBB" }], graceMs: 0 }),
  ).rejects.toThrow();
  expect(await readdir(chunks.directory)).toEqual(before);

  expect(await pruneRecoveryStore({ chunks, roots: [current], graceMs: 60_000 })).toEqual({ removed: 0 });
  const { removed } = await pruneRecoveryStore({ chunks, roots: [current], graceMs: 0 });
  expect(removed).toBeGreaterThan(0);
  await verifyRecoveryCapture(chunks, await readRecoveryManifest(chunks, current));
  await expect(readRecoveryManifest(chunks, previous)).rejects.toThrow();
  const read: string[] = [];
  await captureRecoveryFolder({ root: folder, chunks, progress: (event) => void read.push(event.path) });
  expect(read).toEqual([]);
});
