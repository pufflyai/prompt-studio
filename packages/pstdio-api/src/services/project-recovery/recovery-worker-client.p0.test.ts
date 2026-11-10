import { afterEach, test as baseTest, expect } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { captureRecoveryFolder } from "./capture";
import { createRecoveryChunkStore } from "./chunks";
import { readRecoveryManifest } from "./manifest";
import { nativeRecoverySupported } from "./native-recovery.fixture";
import { folderRecoveryError } from "./operations";
import { createRecoveryPages } from "./pages";
import { captureRecoveryFolderInWorker, verifyRecoveryCaptureInWorker } from "./recovery-worker-client";
import { RecoveryCaptureError } from "./scan";
import { prepareRecoveryCapture } from "./transfer";

const test = baseTest.skipIf(!nativeRecoverySupported);

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await chmod(join(root, "project", "locked"), 0o600).catch(() => {});
    await rm(root, { recursive: true, force: true });
  }
});
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-worker-"));
  roots.push(root);
  const folder = join(root, "project");
  await mkdir(join(folder, "src"), { recursive: true });
  await writeFile(join(folder, ".pstignore"), "dist/\n");
  await writeFile(join(folder, "src/index.ts"), "export {};");
  await mkdir(join(folder, "dist"));
  await writeFile(join(folder, "dist/bundle.js"), "built");
  for (let index = 0; index < 200; index++) await writeFile(join(folder, `note-${index}.md`), `note ${index}`);
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "owner",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const chunks = await createRecoveryChunkStore({ root: join(root, "recovery"), space });
  return { root, folder, chunks };
};
const paths = async (chunks: Awaited<ReturnType<typeof createRecoveryChunkStore>>, inventory: unknown) => {
  const result: string[] = [];
  for await (const entry of createRecoveryPages(chunks).entries(inventory as never)) result.push(entry.path);
  return result.sort();
};

test("a capture in the worker thread records the same folder as one on the API thread", async () => {
  const f = await fixture();
  const signal = new AbortController().signal;
  const inWorker = await captureRecoveryFolderInWorker({ root: f.folder, chunks: f.chunks, gitRoots: [], signal });
  const inline = await captureRecoveryFolder({ root: f.folder, chunks: f.chunks, gitRoots: [], signal });
  expect(inWorker).toMatchObject({ policy: "dist/\n", files: inline.files, bytes: inline.bytes, git: inline.git });
  expect(await paths(f.chunks, inWorker.inventory)).toEqual(await paths(f.chunks, inline.inventory));
  expect(await paths(f.chunks, inWorker.inventory)).not.toContain("dist/bundle.js");
});

test("cancelling stops the worker with the caller's reason", async () => {
  const f = await fixture();
  const controller = new AbortController();
  const reason = new Error("stopped by the owner");
  const capture = captureRecoveryFolderInWorker({
    root: f.folder,
    chunks: f.chunks,
    gitRoots: [],
    signal: controller.signal,
  });
  controller.abort(reason);
  await expect(capture).rejects.toBe(reason);
});

test("worker failures keep the error kinds a person's status is built from", async () => {
  const f = await fixture();
  const signal = new AbortController().signal;
  const missing = captureRecoveryFolderInWorker({ root: join(f.root, "gone"), chunks: f.chunks, gitRoots: [], signal });
  await expect(missing).rejects.toMatchObject({ code: "ENOENT" });
  if (process.getuid?.() === 0) return;
  await writeFile(join(f.folder, "locked"), "unreadable");
  await chmod(join(f.folder, "locked"), 0o000);
  const error = await captureRecoveryFolderInWorker({ root: f.folder, chunks: f.chunks, gitRoots: [], signal }).catch(
    (caught) => caught,
  );
  expect(error).toBeInstanceOf(RecoveryCaptureError);
  expect(error.path).toBe("locked");
  expect(error.cause).toMatchObject({ code: "EACCES" });
});

test("verifying a copy in the worker accepts it intact and reports a damaged chunk as an integrity failure", async () => {
  const f = await fixture();
  const signal = new AbortController().signal;
  const captured = await captureRecoveryFolderInWorker({ root: f.folder, chunks: f.chunks, gitRoots: [], signal });
  const candidate = await prepareRecoveryCapture({
    chunks: f.chunks,
    source: { id: "workspace", deviceId: "laptop", name: "Laptop", folder: f.folder },
    capture: captured,
  });
  const manifest = await readRecoveryManifest(f.chunks, candidate);
  await verifyRecoveryCaptureInWorker(f.chunks, manifest, signal);
  const path = join(f.chunks.directory, `${manifest.capture.inventory.blobId}.blob`);
  const bytes = await readFile(path);
  bytes[bytes.length - 1] ^= 0xff;
  await writeFile(path, bytes);
  const error = await verifyRecoveryCaptureInWorker(f.chunks, manifest, signal).catch((caught) => caught);
  expect(folderRecoveryError(error).code).toBe("integrity");
});
