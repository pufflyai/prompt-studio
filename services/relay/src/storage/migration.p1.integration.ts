import { expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "pg";
import { migrateRelayStorage } from "./database";
import { body, createSyncFixture, encode, randomId, sha256 } from "./sync-fixture";

// The upgrade must preserve encrypted content and multipart progress while retiring grouped tables.
test("relay migration preserves blind documents, blobs and resumable uploads", async () => {
  const databaseUrl = process.env.SYNC_TEST_DATABASE_URL!;
  const migrations = resolve(import.meta.dir, "../../drizzle");
  const directory = await mkdtemp(join(tmpdir(), "relay-upgrade-"));
  const fixture = createSyncFixture();
  const client = new Client({ connectionString: databaseUrl });
  try {
    const journal = JSON.parse(await readFile(join(migrations, "meta/_journal.json"), "utf8"));
    const removal = journal.entries.findIndex((entry: { tag: string }) => entry.tag === "0004_jazzy_nomad");
    expect(removal).toBeGreaterThan(0);
    const previous = { ...journal, entries: journal.entries.slice(0, removal) };
    await mkdir(join(directory, "meta"));
    await writeFile(join(directory, "meta/_journal.json"), JSON.stringify(previous));
    for (const entry of previous.entries)
      await copyFile(join(migrations, `${entry.tag}.sql`), join(directory, `${entry.tag}.sql`));
    await migrateRelayStorage(databaseUrl, directory);
    // Fixture initialization runs the same prior migrations and creates this test's object bucket.
    await fixture.initialize(directory);
    const { sync } = fixture.open();
    const address = { projectKey: randomId("project"), spaceOwner: null, documentId: randomId("doc") };
    const caller = { accountId: randomId("account"), deviceId: randomId("device") };
    const bytes = new Uint8Array([9, 4, 2]);
    const blob = { ...address, blobId: randomId("blob") };
    const descriptor = { byteLength: bytes.length, sha256: sha256(bytes) };
    await sync.blobs.begin(blob, caller, descriptor);
    await sync.blobs.writePart(blob, 1, { ...descriptor, body: body(bytes) });
    await sync.blobs.finish(blob);
    const update = { updateId: randomId("update"), payload: encode(bytes), blobIds: [blob.blobId] };
    await sync.documents.appendUpdate(address, caller, update);
    const state = {
      stateId: randomId("state"),
      baseStateId: null,
      through: 1,
      payload: encode(bytes),
      summary: encode(new Uint8Array([1])),
      blobIds: [blob.blobId],
    };
    await sync.documents.replaceState(address, caller, state);
    const pending = { ...address, blobId: randomId("pending") };
    await sync.blobs.begin(pending, caller, descriptor);
    await sync.blobs.writePart(pending, 1, { ...descriptor, body: body(bytes) });
    await client.connect();
    await client.query(`INSERT INTO relay_scopes
      (id, scope, epoch, "acceptedSequence", "journalSequence", "replayFrom", "publishedRevision")
      VALUES ('retired-owner', '{}', 'epoch', 0, 0, 0, 'old')`);

    await migrateRelayStorage(databaseUrl, migrations);

    expect(await sync.documents.appendUpdate(address, caller, update)).toEqual({ sequence: 1, duplicate: true });
    const stored = await sync.documents.readState(address, state.stateId);
    expect(new Uint8Array(await new Response(stored!.body).arrayBuffer())).toEqual(bytes);
    expect(new Uint8Array(await new Response((await sync.blobs.read(blob, 0)).body).arrayBuffer())).toEqual(bytes);
    const resumed = await sync.blobs.begin(pending, caller, descriptor);
    expect(resumed.parts).toHaveLength(1);
    await sync.blobs.finish(pending);
    expect(new Uint8Array(await new Response((await sync.blobs.read(pending, 0)).body).arrayBuffer())).toEqual(bytes);
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    expect(tables.rows.map((row) => row.tablename)).not.toContain("relay_scopes");
  } finally {
    await client.end();
    await fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
});
