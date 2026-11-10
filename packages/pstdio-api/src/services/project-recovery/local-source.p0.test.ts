import { afterEach, test as baseTest, expect } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import type { createRecoveryCatalog } from "./catalog";
import { createRecoveryChunkStore, type RecoveryChunk } from "./chunks";
import { openRecoveryJournal } from "./journal";
import { createLocalRecoverySource } from "./local-source";
import { nativeRecoverySupported } from "./native-recovery.fixture";

const test = baseTest.skipIf(!nativeRecoverySupported);

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
  await writeFile(join(folder, ".pstignore"), "node_modules/\n");
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
  const workspace: {
    id: string;
    root_path: string | null;
    execution_kind: string;
    initializing: boolean;
    provider_state: string;
  } = {
    id: "workspace",
    root_path: folder,
    execution_kind: "local",
    initializing: false,
    provider_state: "ready",
  };
  const sourceId = `workspace:${createHash("sha256").update(folder).digest("hex").slice(0, 16)}`;
  const start = (journalRoot = join(root, "recovery"), gapMs = 0) => {
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
      schedule: { quietMs: 5, gapMs },
      captured: () => {
        captured++;
      },
      failed: () => {},
    });
    return { local, captured: () => captured };
  };
  const journal = (journalRoot = join(root, "recovery")) =>
    openRecoveryJournal({ root: journalRoot, source: ["project", "account", "laptop", sourceId] });
  return { root, folder, store, entries, published, start, journal, sourceId, workspace };
};

test("a folder that becomes the project's folder, such as a restored one, is captured at once instead of after the rescan gap", async () => {
  const f = await fixture();
  const previous = join(f.root, "previous");
  await mkdir(previous);
  await writeFile(join(previous, ".pstignore"), "");
  f.workspace.root_path = previous;
  const owner = f.start(undefined, 60_000);
  owner.local.request("startup");
  await until(() => owner.captured() > 0);
  await until(async () => !(await owner.local.status()).capturing);
  f.workspace.root_path = f.folder;
  await owner.local.workspaceChanged();
  await until(async () => !!(await (await f.journal()).read()).candidate);
  await owner.local.close();
});

test("a workspace change that keeps the same folder waits for the rescan gap, even after its watch was lost", async () => {
  const f = await fixture();
  const owner = f.start(undefined, 60_000);
  owner.local.request("startup");
  await until(() => owner.captured() > 0);
  await until(async () => !(await owner.local.status()).capturing);
  const first = (await (await f.journal()).read()).candidate;
  // Losing the watch must not turn every later workspace event into an immediate full scan.
  await rm(f.folder, { recursive: true });
  await mkdir(f.folder);
  await writeFile(join(f.folder, "notes"), "saved again");
  await Bun.sleep(50);
  await owner.local.workspaceChanged();
  await Bun.sleep(300);
  expect((await (await f.journal()).read()).candidate).toEqual(first);
  await owner.local.close();
});

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

test("a folder without .pstignore is never copied and drops its pending copy until a .pstignore is added", async () => {
  const f = await fixture();
  await rm(join(f.folder, ".pstignore"));
  await (await f.journal()).update({
    candidate: {
      blobId: "AAAAAAAAAAAAAAAAAAAAAA",
      byteLength: 10,
      sha256: "a".repeat(64),
      encryptedByteLength: 38,
      encryptedSha256: "b".repeat(64),
    },
  });
  const owner = f.start();
  owner.local.request("startup");
  await until(async () => (await (await f.journal()).read()).candidate === null);
  await until(async () => !(await owner.local.status()).capturing);
  expect(owner.captured()).toBe(0);
  await expect(readFile(join(f.folder, ".pstignore"))).rejects.toThrow();
  await writeFile(join(f.folder, ".pstignore"), "");
  owner.local.request("explicit");
  await until(async () => !!(await (await f.journal()).read()).candidate);
  expect(owner.captured()).toBe(1);
  await owner.local.close();
});

test("a folder whose workspace is still being set up is not captured until it is ready", async () => {
  const f = await fixture();
  f.workspace.initializing = true;
  const owner = f.start();
  owner.local.request("startup");
  await until(async () => !(await owner.local.status()).pending && !(await owner.local.status()).capturing);
  expect((await (await f.journal()).read()).candidate).toBeNull();
  f.workspace.initializing = false;
  owner.local.request("explicit");
  await until(async () => !!(await (await f.journal()).read()).candidate);
  await owner.local.close();
});
