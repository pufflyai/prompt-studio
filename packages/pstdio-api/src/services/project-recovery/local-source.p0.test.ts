import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { captureRecoveryFolder } from "./capture";
import type { createRecoveryCatalog } from "./catalog";
import { createRecoveryChunkStore, type RecoveryChunk } from "./chunks";
import { openRecoveryJournal } from "./journal";
import { createLocalRecoverySource } from "./local-source";
import { prepareRecoveryCapture } from "./transfer";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const until = async (condition: () => boolean | Promise<boolean>) => {
  const end = Date.now() + 5000;
  while (!(await condition()) && Date.now() < end) await Bun.sleep(5);
  expect(await condition()).toBe(true);
};
const transport = { put: async () => {}, get: async () => new Uint8Array() };

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-local-source-"));
  roots.push(root);
  const folder = join(root, "project");
  await mkdir(folder);
  await writeFile(join(folder, "notes"), "saved work");
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "account",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const store = await createRecoveryChunkStore({ root: join(root, "recovery", "chunks"), space });
  const entries: { deviceId: string; sourceId: string; root: RecoveryChunk }[] = [];
  const published: RecoveryChunk[] = [];
  const catalog = {
    list: async () => entries,
    publish: async ({ candidate }: { candidate: RecoveryChunk }) => {
      published.push(candidate);
    },
  } as unknown as ReturnType<typeof createRecoveryCatalog>;
  const workspace = { id: "workspace", root_path: folder, execution_kind: "local" };
  const sourceId = `workspace:${createHash("sha256").update(folder).digest("hex").slice(0, 16)}`;
  const start = (journalRoot = join(root, "recovery")) => {
    let captured = 0;
    const local = createLocalRecoverySource({
      workbenchId: "project",
      accountId: "account",
      deviceId: "laptop",
      root: journalRoot,
      workspaces: { getDefault: async () => workspace, list: async () => [workspace] },
      catalog,
      chunks: () => store,
      signal: new AbortController().signal,
      schedule: { quietMs: 5, gapMs: 0 },
      captured: () => {
        captured++;
      },
      failed: () => {},
    });
    return { local, captured: () => captured };
  };
  const journal = (journalRoot = join(root, "recovery")) =>
    openRecoveryJournal({ root: journalRoot, source: ["project", "account", "laptop", sourceId] });
  return { root, folder, store, entries, published, start, journal, sourceId };
};

test("a candidate saved before a restart is published even when the folder did not change", async () => {
  const f = await fixture();
  const first = f.start();
  first.local.request("startup");
  await until(async () => !!(await (await f.journal()).read()).candidate);
  const candidate = (await (await f.journal()).read()).candidate!;
  await first.local.close();

  const restarted = f.start();
  await restarted.local.publish(f.store, transport, new AbortController().signal);
  expect(f.published).toEqual([candidate]);
  expect((await (await f.journal()).read()).candidate).toBeNull();
  await restarted.local.close();
});

test("an unreadable candidate is dropped and replaced by a fresh capture instead of blocking publication", async () => {
  const f = await fixture();
  const owner = f.start();
  await (await f.journal()).update({
    enrolled: true,
    candidate: {
      blobId: "AAAAAAAAAAAAAAAAAAAAAA",
      byteLength: 10,
      sha256: "a".repeat(64),
      encryptedByteLength: 38,
      encryptedSha256: "b".repeat(64),
    },
  });
  await owner.local.publish(f.store, transport, new AbortController().signal);
  expect(f.published).toEqual([]);
  await until(async () => (await (await f.journal()).read()).candidate?.blobId !== "AAAAAAAAAAAAAAAAAAAAAA");
  await until(() => owner.captured() > 0);
  await owner.local.close();
});

test("a source whose catalog copy deliberately had no policy is never seeded after losing recovery storage", async () => {
  const f = await fixture();
  const capture = await captureRecoveryFolder({ root: f.folder, chunks: f.store });
  expect(capture.policy).toBeNull();
  const root = await prepareRecoveryCapture({
    chunks: f.store,
    source: { id: f.sourceId, deviceId: "laptop", name: "Laptop", folder: f.folder },
    capture,
  });
  f.entries.push({ deviceId: "laptop", sourceId: f.sourceId, root });
  const fresh = join(f.root, "replaced-recovery-storage");
  const owner = f.start(fresh);
  owner.local.request("startup");
  await until(async () => (await (await f.journal(fresh)).read()).enrolled);
  await owner.local.close();
  await expect(readFile(join(f.folder, ".pstignore"))).rejects.toThrow();
});
