import { expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "pg";
import { fingerprint } from "pstdio-sync-contracts";
import { createAssetObjects } from "../assets/objects";
import { multipartSize } from "../assets/streams";
import { blobAsset, blobOwner } from "./blobs";
import { migrateRelayStorage } from "./database";
import { documentObjectPrefix } from "./payloads";
import { body, createSyncFixture, encode, randomId, sha256 } from "./sync-fixture";

// The upgrade must preserve encrypted content and multipart progress while retiring grouped tables.
test("relay migration preserves blind documents, blobs and resumable uploads", async () => {
  const databaseUrl = process.env.SYNC_TEST_DATABASE_URL!;
  const migrations = resolve(import.meta.dir, "../../drizzle");
  const directory = await mkdtemp(join(tmpdir(), "relay-upgrade-"));
  const fixture = createSyncFixture();
  const client = new Client({ connectionString: databaseUrl });
  const objects = createAssetObjects(fixture);
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
    const pending = { ...address, blobId: randomId("pending") };
    const descriptor = { byteLength: bytes.length, sha256: sha256(bytes) };
    const update = { updateId: randomId("update"), payload: encode(bytes), blobIds: [blob.blobId] };
    const stateId = randomId("state");
    const prefix = documentObjectPrefix(address.projectKey, address.documentId);
    const updateKey = `${prefix}updates/${crypto.randomUUID()}`;
    const stateKey = `${prefix}states/${crypto.randomUUID()}`;
    await fixture.putLegacyObject(updateKey, bytes);
    await fixture.putLegacyObject(stateKey, bytes);
    await client.connect();
    await client.query(
      'INSERT INTO relay_sync_projects ("projectKey", "accountId", "createdAt") VALUES ($1, $2, now())',
      [address.projectKey, caller.accountId],
    );
    for (const [upload, status] of [
      [blob, "completed"],
      [pending, "open"],
    ] as const) {
      // Seed the prior schema and its original object addresses without starting the new asset owner.
      const ownerId = await fingerprint(blobOwner(upload));
      const objectKey = `assets/${ownerId}/${await fingerprint(upload.blobId)}`;
      const asset = blobAsset(descriptor);
      const multipartId = await objects.begin(objectKey, asset);
      const signal = new AbortController().signal;
      const etag = await objects.write(objectKey, multipartId, 1, { ...descriptor, body: body(bytes) }, signal);
      await client.query(
        `INSERT INTO relay_asset_uploads ("ownerId", id, asset, "objectKey", "partSize", "multipartId", status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ownerId, upload.blobId, asset, objectKey, multipartSize(bytes.length), multipartId, status],
      );
      await client.query(
        `INSERT INTO relay_asset_parts ("ownerId", "uploadId", number, sha256, "byteLength", etag)
        VALUES ($1, $2, 1, $3, $4, $5)`,
        [ownerId, upload.blobId, descriptor.sha256, descriptor.byteLength, etag],
      );
      if (status === "completed") {
        await objects.finish(objectKey, multipartId, [{ number: 1, etag, sha256: descriptor.sha256 }], signal);
        await client.query(
          `INSERT INTO relay_verified_assets ("ownerId", reference, asset, "objectKey", etag) VALUES ($1, $2, $3, $4, $5)`,
          [ownerId, await fingerprint(asset), asset, objectKey, await objects.verify(objectKey, asset, signal)],
        );
      }
      await client.query(
        `INSERT INTO relay_sync_blobs ("projectKey", "blobId", sha256, "byteLength", status, "createdAt", "completedAt")
        VALUES ($1, $2, $3, $4, $5, now(), CASE WHEN $5 = 'completed' THEN now() END)`,
        [address.projectKey, upload.blobId, descriptor.sha256, descriptor.byteLength, status],
      );
    }
    await client.query(
      `INSERT INTO relay_sync_documents ("projectKey", "documentId", "lastSequence", "stateId")
      VALUES ($1, $2, 1, $3)`,
      [address.projectKey, address.documentId, stateId],
    );
    await client.query(
      `INSERT INTO relay_sync_updates
      ("projectKey", "documentId", sequence, "updateId", "deviceId", "byteLength", "objectKey", "blobIds", "createdAt")
      VALUES ($1, $2, 1, $3, $4, $5, $6, $7, now())`,
      [
        address.projectKey,
        address.documentId,
        update.updateId,
        caller.deviceId,
        bytes.length,
        updateKey,
        update.blobIds,
      ],
    );
    await client.query(
      `INSERT INTO relay_sync_states
      ("projectKey", "documentId", "stateId", through, "byteLength", summary, "objectKey", "blobIds", "deviceId", "createdAt")
      VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, now())`,
      [
        address.projectKey,
        address.documentId,
        stateId,
        bytes.length,
        encode(new Uint8Array([1])),
        stateKey,
        update.blobIds,
        caller.deviceId,
      ],
    );
    await client.query(`INSERT INTO relay_scopes
      (id, scope, epoch, "acceptedSequence", "journalSequence", "replayFrom", "publishedRevision")
      VALUES ('retired-owner', '{}', 'epoch', 0, 0, 0, 'old')`);

    await migrateRelayStorage(databaseUrl, migrations);

    expect(await sync.documents.appendUpdate(address, caller, update)).toEqual({ sequence: 1, duplicate: true });
    const stored = await sync.documents.readState(address, stateId);
    expect(new Uint8Array(await new Response(stored!.body).arrayBuffer())).toEqual(bytes);
    expect(new Uint8Array(await new Response((await sync.blobs.read(blob, 0)).body).arrayBuffer())).toEqual(bytes);
    const resumed = await sync.blobs.begin(pending, caller, descriptor);
    expect(resumed.parts).toHaveLength(1);
    await sync.blobs.finish(pending);
    expect(new Uint8Array(await new Response((await sync.blobs.read(pending, 0)).body).arrayBuffer())).toEqual(bytes);
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    expect(tables.rows.map((row) => row.tablename)).not.toContain("relay_scopes");
  } finally {
    objects.close();
    await client.end();
    await fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
});
