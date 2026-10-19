import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQL } from "bun";
import { fingerprint } from "pstdio-sync-contracts";
import { sealStoredMutation as sealMutation } from "./mutation.fixture";
import { createRelayStorage, migrateRelayStorage } from "./storage";

const databaseUrl = process.env.SYNC_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("Run through the isolated conformance runner");

const root = await mkdtemp(join(tmpdir(), "relay-publisher-"));
const processEntry = join(root, "publisher.js");
beforeAll(async () => {
  await migrateRelayStorage(databaseUrl, resolve(import.meta.dir, "../../drizzle"));
  const bundle = await Bun.build({
    entrypoints: [resolve(import.meta.dir, "publication-process.fixture.ts")],
    target: "bun",
  });
  if (!bundle.success) throw new AggregateError(bundle.logs, "Could not build the publisher fixture");
  await Bun.write(processEntry, bundle.outputs[0]!);
});
afterAll(() => rm(root, { recursive: true, force: true }));

test("killing a publisher before commit rolls back its whole group and retry survives another process", async () => {
  const started = performance.now();
  const phase = (name: string) =>
    console.log(`Publisher kill phase ${name}: ${(performance.now() - started).toFixed(2)}ms`);
  const sql = new SQL(databaseUrl);
  const lock = await sql.reserve();
  const storage = createRelayStorage(databaseUrl, { complete: async () => true });
  const scope = { accountId: "crash-test", workbenchId: crypto.randomUUID(), extensionId: "notes" };
  const owner = await storage.initialize(scope, "published-1");
  const mutation = await sealMutation({
    protocolVersion: 2,
    scope,
    environmentId: "publisher",
    operationId: crypto.randomUUID(),
    parents: [],
    changes: await Promise.all(
      ["note", "caption"].map(async (recordId) => ({
        recordId,
        expectedRevision: 0,
        baseDeleted: false,
        value: { expected: await fingerprint(null), next: "durable" },
      })),
    ),
  });
  const spawn = () =>
    Bun.spawn(["bun", processEntry], {
      env: { ...process.env, RELAY_TEST_MUTATION: JSON.stringify(mutation) },
      stdout: "pipe",
      stderr: "inherit",
    });
  let child: ReturnType<typeof spawn> | undefined;
  let waiting: Promise<number> | undefined;
  try {
    await sql`CREATE FUNCTION relay_test_block_commit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_advisory_xact_lock(758); RETURN NEW; END
    $$`;
    await sql`CREATE TRIGGER relay_test_block_commit BEFORE INSERT ON relay_operations
      FOR EACH ROW EXECUTE FUNCTION relay_test_block_commit()`;
    await lock`SELECT pg_advisory_lock(758)`;
    child = spawn();
    phase("first process spawned");
    waiting = child.exited;
    // Observe the actual transaction boundary instead of guessing when to kill it.
    let blocked = false;
    while (!blocked) {
      const rows = await sql`SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event = 'advisory'`;
      blocked = rows.length > 0;
      if (child.exitCode !== null) throw new Error("Publisher exited before reaching the commit boundary");
      if (!blocked) await Bun.sleep(10);
    }
    child.kill("SIGKILL");
    phase("before-commit boundary reached");
    await waiting;
    await lock`SELECT pg_advisory_unlock(758)`;
    const before = await owner.snapshot();
    expect(before.records).toEqual({});
    expect(before.receipts).toEqual({});
    expect(before.checkpoint.sequence).toBe(0);
    phase("rollback verified");
    child = spawn();
    waiting = child.exited;
    const reader = child.stdout.getReader();
    let output = "";
    while (!output.includes("\n")) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error("Publisher exited without its committed receipt");
      output += new TextDecoder().decode(chunk.value);
    }
    const receipt = JSON.parse(output.trim());
    phase("second process committed");
    expect(receipt.status).toBe("accepted");
    child.kill("SIGKILL");
    await waiting;
    reader.releaseLock();
    const reopened = createRelayStorage(databaseUrl, { complete: async () => true });
    try {
      expect(await reopened.owner(scope).submit(mutation)).toEqual(receipt);
      const saved = await reopened.owner(scope).snapshot();
      expect(saved.records.note.value).toBe("durable");
      expect(saved.records.caption.value).toBe("durable");
      expect(saved.checkpoint.sequence).toBe(1);
      expect(saved.journalSequence).toBe(1);
      phase("durable retry verified");
    } finally {
      await reopened.close();
    }
  } finally {
    child?.kill("SIGKILL");
    await waiting;
    await lock`SELECT pg_advisory_unlock_all()`;
    lock.release();
    await sql`DROP TRIGGER IF EXISTS relay_test_block_commit ON relay_operations`;
    await sql`DROP FUNCTION IF EXISTS relay_test_block_commit()`;
    await storage.close();
    await sql.close();
  }
});
