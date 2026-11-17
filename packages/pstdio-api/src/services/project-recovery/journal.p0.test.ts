import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openRecoveryJournal } from "./journal";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

test("an unacknowledged candidate survives a restart without plaintext identities", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-journal-"));
  roots.push(root);
  const source = ["project", "account", "/private/folder/.env-project"];
  const journal = await openRecoveryJournal({ root, source });
  expect(await journal.read()).toEqual({ version: 1, candidate: null });
  const candidate = {
    blobId: "AAAAAAAAAAAAAAAAAAAAAA",
    byteLength: 10,
    sha256: "a".repeat(64),
    encryptedByteLength: 38,
    encryptedSha256: "b".repeat(64),
  };
  await journal.update({ candidate });
  const reopened = await openRecoveryJournal({ root, source });
  expect(await reopened.read()).toEqual({ version: 1, candidate });
  expect(JSON.stringify(await readdir(join(root, "sources")))).not.toContain("private");
});

test("one live process owns a source operation and an exited owner's lock is taken over", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-journal-"));
  roots.push(root);
  const journal = await openRecoveryJournal({ root, source: ["project", "account", "workspace"] });
  const release = await journal.acquire();
  expect(release).not.toBeNull();
  expect(await journal.acquire()).toBeNull();
  const [lock] = (await readdir(join(root, "sources"))).filter((name) => name.endsWith(".lock"));
  await release!();
  // The OS lease file stays on the same inode between owners.
  expect(await readdir(join(root, "sources"))).toEqual([`${lock}.sqlite`]);
  await writeFile(join(root, "sources", lock!), String(Bun.spawnSync(["true"]).pid));
  const takeover = await journal.acquire();
  expect(takeover).not.toBeNull();
  await takeover!();
});

test("a lock left by an earlier process with this PID, or without a recent heartbeat, is taken over by exactly one owner", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-journal-"));
  roots.push(root);
  const source = ["project", "account", "workspace"];
  const journal = await openRecoveryJournal({ root, source });
  const held = await journal.acquire();
  const [lock] = (await readdir(join(root, "sources"))).filter((name) => name.endsWith(".lock"));
  await held!();
  const path = join(root, "sources", lock!);

  // A restarted container process often receives the same PID as the crashed owner.
  await writeFile(path, JSON.stringify({ pid: process.pid, token: "crashed-owner" }));
  const reused = await journal.acquire();
  expect(reused).not.toBeNull();
  await reused!();

  // A live but unrelated process reusing the PID never refreshes the heartbeat.
  const unrelated = Bun.spawn(["sleep", "30"]);
  try {
    await writeFile(path, JSON.stringify({ pid: unrelated.pid, token: "other" }));
    expect(await journal.acquire()).toBeNull();
    const old = new Date(Date.now() - 10 * 60_000);
    await utimes(path, old, old);
    const contenders = await Promise.all(
      Array.from({ length: 4 }, async () => (await openRecoveryJournal({ root, source })).acquire()),
    );
    expect(contenders.filter(Boolean)).toHaveLength(1);
    await contenders.find(Boolean)!();
  } finally {
    unrelated.kill();
  }
});
