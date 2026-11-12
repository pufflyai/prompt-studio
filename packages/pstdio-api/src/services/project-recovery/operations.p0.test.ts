import { afterEach, test as baseTest, expect } from "bun:test";
import { lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { captureRecoveryFolder } from "./capture";
import type { createRecoveryCatalog } from "./catalog";
import { createRecoveryChunkStore } from "./chunks";
import { nativeRecoverySupported } from "./native-recovery.fixture";
import { createRecoveryOperations, type RecoveryAttach } from "./operations";
import { prepareRecoveryCapture } from "./transfer";

const test = baseTest.skipIf(!nativeRecoverySupported);

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

/** Another device's completed copy, served by a relay that holds its ciphertext. */
const fixture = async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "recovery-operations-")));
  roots.push(root);
  const folder = join(root, "laptop");
  await mkdir(folder);
  await writeFile(join(folder, "notes.md"), "saved without a commit");
  await writeFile(
    join(folder, "data.bin"),
    new Uint8Array(4096).map((_, index) => index % 251),
  );
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "owner",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const source = await createRecoveryChunkStore({ root: join(root, "laptop-recovery"), space });
  const local = await createRecoveryChunkStore({ root: join(root, "desktop-recovery"), space });
  const candidate = await prepareRecoveryCapture({
    chunks: source,
    source: { id: "workspace", deviceId: "laptop", name: "Laptop", folder },
    capture: await captureRecoveryFolder({ root: folder, chunks: source }),
  });
  const transport = {
    put: async () => {},
    get: async (blobId: string) => new Uint8Array(await readFile(join(source.directory, `${blobId}.blob`))),
  };
  const catalog = {
    list: async () => [{ deviceId: "laptop", sourceId: "workspace", root: candidate }],
  } as unknown as ReturnType<typeof createRecoveryCatalog>;
  const controller = new AbortController();
  const operations = createRecoveryOperations({
    workRoot: join(root, "desktop-recovery"),
    deviceId: "desktop",
    catalog,
    chunks: () => local,
    transport: () => ({ transport, signal: controller.signal }) as never,
    changed: () => {},
    signal: controller.signal,
  });
  const restore = async (path: string, attach: RecoveryAttach = async () => false) => {
    await operations.restore({ deviceId: "laptop", sourceId: "workspace", path }, attach);
    const end = Date.now() + 10_000;
    while (operations.status().restore.state === "running" && Date.now() < end) await Bun.sleep(10);
    return operations.status().restore;
  };
  return { root, local, operations, restore };
};

test("a corrupted local chunk fails verification and the next restore downloads it again", async () => {
  const { root, local, restore } = await fixture();
  expect(await restore(join(root, "first"))).toMatchObject({ state: "complete" });
  // Damage the largest retained ciphertext without changing its size.
  let largest = { name: "", size: 0 };
  for (const name of await readdir(local.directory)) {
    const { size } = await stat(join(local.directory, name));
    if (name.endsWith(".blob") && size > largest.size) largest = { name, size };
  }
  const bytes = await readFile(join(local.directory, largest.name));
  bytes[bytes.length - 1]! ^= 0xff;
  await writeFile(join(local.directory, largest.name), bytes);

  expect(await restore(join(root, "second"))).toMatchObject({ state: "failed", error: { code: "integrity" } });
  await expect(lstat(join(root, "second"))).rejects.toThrow();
  expect(await restore(join(root, "third"))).toMatchObject({ state: "complete", error: null });
  expect(await readFile(join(root, "third", "notes.md"), "utf8")).toBe("saved without a commit");
});

test("a cancel that arrives after publication reports the attach failure and the restored folder", async () => {
  const { root, operations, restore } = await fixture();
  const destination = join(root, "restored");
  const result = await restore(destination, async () => {
    void operations.cancel();
    throw new Error("binding failed");
  });
  expect(result.state).toBe("failed");
  expect(result.error?.code).toBe("failed");
  expect(result.error?.message).toContain("binding failed");
  expect(result.error?.message).toContain(destination);
  expect(result.result).toMatchObject({ path: destination, attached: false });
  expect(await readFile(join(destination, "notes.md"), "utf8")).toBe("saved without a commit");
});
