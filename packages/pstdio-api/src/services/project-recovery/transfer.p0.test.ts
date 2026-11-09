import { afterEach, test as baseTest, expect } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { captureRecoveryFolder } from "./capture";
import { createRecoveryChunkStore, type RecoveryChunk, recoveryChunkBytes } from "./chunks";
import { nativeRecoverySupported } from "./native-recovery.fixture";
import { createRecoveryPages } from "./pages";
import { downloadRecoveryCapture, prepareRecoveryCapture, publishRecoveryCapture } from "./transfer";

const test = baseTest.skipIf(!nativeRecoverySupported);

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-transfer-"));
  roots.push(root);
  const folder = join(root, "project");
  await mkdir(folder);
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "account",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const chunks = await createRecoveryChunkStore({ root: join(root, "sender"), space });
  const source = { id: "device-workspace", deviceId: "device", name: "My laptop", folder };
  const contents = new Uint8Array(recoveryChunkBytes + 23).fill(179);
  await writeFile(join(folder, ".env-secret"), contents);
  const capture = await captureRecoveryFolder({ root: folder, chunks });
  const candidate = await prepareRecoveryCapture({ chunks, source, capture });
  const remote = new Map<string, { bytes: Uint8Array; children: string[] }>();
  let loseAcknowledgement = false;
  const puts: string[] = [];
  const transport = {
    async put(id: string, bytes: Uint8Array, children: string[]) {
      expect(bytes.length).toBeLessThanOrEqual(recoveryChunkBytes + 256);
      for (const child of children) expect(remote.has(child)).toBe(true);
      remote.set(id, { bytes: bytes.slice(), children });
      puts.push(id);
      if (loseAcknowledgement) {
        loseAcknowledgement = false;
        throw new Error("Acknowledgement lost");
      }
    },
    async get(id: string, byteLength: number) {
      const row = remote.get(id);
      if (!row || row.bytes.length !== byteLength) throw new Error("Missing encrypted blob");
      return row.bytes.slice();
    },
  };
  return {
    root,
    folder,
    chunks,
    source,
    contents,
    candidate,
    remote,
    puts,
    transport,
    lose: () => {
      loseAcknowledgement = true;
    },
  };
};

test("publication waits for every acknowledged child, reuses a retained candidate after restart, and downloads without its source", async () => {
  const f = await fixture();
  const published: RecoveryChunk[] = [];
  const complete = async (reference: RecoveryChunk) => {
    published.push(reference);
  };
  f.lose();
  await expect(
    publishRecoveryCapture({ chunks: f.chunks, candidate: f.candidate, transport: f.transport, complete }),
  ).rejects.toThrow("Acknowledgement lost");
  expect(published).toEqual([]);
  expect(f.remote.has(f.candidate.blobId)).toBe(false);
  const first = f.puts[0]!;
  const reopened = await createRecoveryChunkStore({ root: f.chunks.root, space: f.chunks.space });
  await publishRecoveryCapture({ chunks: reopened, candidate: f.candidate, transport: f.transport, complete });
  expect(published).toEqual([f.candidate]);
  expect(f.puts.filter((id) => id === first)).toHaveLength(2);
  expect(f.puts.at(-1)).toBe(f.candidate.blobId);
  for (const [id, row] of f.remote) {
    expect(id).not.toContain(".env-secret");
    expect(new TextDecoder().decode(row.bytes)).not.toContain(".env-secret");
    expect(new TextDecoder().decode(row.bytes)).not.toContain("My laptop");
  }
  await rm(f.folder, { recursive: true });
  await rm(f.chunks.root, { recursive: true });
  const receiver = await createRecoveryChunkStore({ root: join(f.root, "receiver"), space: f.chunks.space });
  const downloaded = await downloadRecoveryCapture({
    chunks: receiver,
    candidate: f.candidate,
    transport: f.transport,
  });
  expect(downloaded.source).toEqual(f.source);
  const pages = createRecoveryPages(receiver);
  const bytes: Uint8Array[] = [];
  for await (const entry of pages.entries(downloaded.capture.inventory)) {
    if (entry.kind !== "file") continue;
    expect(entry.path).toBe(".env-secret");
    for await (const reference of pages.parts(entry.content)) bytes.push(await receiver.read(reference));
  }
  expect(new Uint8Array(Buffer.concat(bytes))).toEqual(f.contents);
});

test("download rejects corrupted encrypted bytes and cancellation never publishes a completed source", async () => {
  const f = await fixture();
  let completed = false;
  const controller = new AbortController();
  controller.abort(new Error("Capture cancelled"));
  await expect(
    publishRecoveryCapture({
      chunks: f.chunks,
      candidate: f.candidate,
      transport: f.transport,
      signal: controller.signal,
      complete: async () => {
        completed = true;
      },
    }),
  ).rejects.toThrow("Capture cancelled");
  expect(completed).toBe(false);
  await publishRecoveryCapture({
    chunks: f.chunks,
    candidate: f.candidate,
    transport: f.transport,
    complete: async () => {},
  });
  const receiver = await createRecoveryChunkStore({ root: join(f.root, "receiver"), space: f.chunks.space });
  await expect(
    downloadRecoveryCapture({
      chunks: receiver,
      candidate: f.candidate,
      transport: {
        ...f.transport,
        get: async (id, size) => {
          const bytes = await f.transport.get(id, size);
          bytes[bytes.length - 1] ^= 1;
          return bytes;
        },
      },
    }),
  ).rejects.toThrow();
});
