import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openRecoveryJournal } from "./journal";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

test("source enrollment and an unacknowledged candidate survive a restart without plaintext identities", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-journal-"));
  roots.push(root);
  const source = ["project", "account", "/private/folder/.env-project"];
  const journal = await openRecoveryJournal({ root, source });
  expect(await journal.read()).toEqual({ version: 1, enrolled: false, candidate: null });
  const candidate = {
    blobId: "AAAAAAAAAAAAAAAAAAAAAA",
    byteLength: 10,
    sha256: "a".repeat(64),
    encryptedByteLength: 38,
    encryptedSha256: "b".repeat(64),
  };
  await journal.update({ enrolled: true });
  await journal.update({ candidate });
  const reopened = await openRecoveryJournal({ root, source });
  expect(await reopened.read()).toEqual({ version: 1, enrolled: true, candidate });
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
  expect(await readdir(join(root, "sources"))).toEqual([]);
  await writeFile(join(root, "sources", lock!), String(Bun.spawnSync(["true"]).pid));
  const takeover = await journal.acquire();
  expect(takeover).not.toBeNull();
  await takeover!();
});
