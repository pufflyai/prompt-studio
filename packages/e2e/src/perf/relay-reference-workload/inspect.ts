import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { Client } from "pg";
import { fingerprint } from "pstdio-sync-contracts";
import type { StorageRows } from "./measurements";
import { listObjects, listUnfinishedUploads } from "./object-inventory";

export const inspectStorage = async (databaseUrl: string, s3: S3ClientConfig) => {
  const database = new Client({ connectionString: databaseUrl });
  const objects = new S3Client({ ...s3, maxAttempts: 1 });
  await database.connect();
  try {
    const tables = await database.query<{ name: string; rows: number; bytes: number }>(`
      SELECT c.relname AS name, pg_total_relation_size(c.oid)::float8 AS bytes,
        (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = c.oid) AS columns
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname`);
    const tableSizes = [];
    for (const table of tables.rows) {
      const count = await database.query(`SELECT count(*)::float8 AS count FROM "${table.name}"`);
      tableSizes.push({ name: table.name, rows: count.rows[0].count, bytes: table.bytes });
    }
    const states = await database.query(
      `SELECT "projectKey", "documentId", "stateId", "byteLength"::float8, "blobIds", "replacedAt", "objectKey" FROM relay_sync_states`,
    );
    const updates = await database.query(
      `SELECT "projectKey", "documentId", "byteLength"::float8, "blobIds", "coveredAt", "objectKey" FROM relay_sync_updates`,
    );
    const blobs = await database.query(
      `SELECT "projectKey", "blobId", "byteLength"::float8, status FROM relay_sync_blobs`,
    );
    const documents = await database.query(
      `SELECT "projectKey", "documentId", "lastSequence"::float8 FROM relay_sync_documents`,
    );
    const uploads = await database.query(
      `SELECT "ownerId", id, "objectKey" FROM relay_asset_uploads WHERE status = 'completed'`,
    );
    const uploadsByOwner = new Map(uploads.rows.map((row) => [`${row.ownerId}/${row.id}`, row]));
    const expectedObjects: { key: string; bytes: number }[] = [...states.rows, ...updates.rows].map((row) => ({
      key: row.objectKey,
      bytes: row.byteLength,
    }));
    const missingBlobMappings: string[] = [];
    for (const row of blobs.rows) {
      const ownerId = await fingerprint({ projectKey: row.projectKey, blobId: row.blobId });
      const upload = uploadsByOwner.get(`${ownerId}/${row.blobId}`);
      if (!upload) missingBlobMappings.push(row.blobId);
      else expectedObjects.push({ key: upload.objectKey, bytes: row.byteLength });
    }
    const listed = await listObjects(objects);
    const unfinishedUploads = await listUnfinishedUploads(objects);
    return {
      rows: { states: states.rows, updates: updates.rows, blobs: blobs.rows } as StorageRows,
      documents: documents.rows,
      tables: tableSizes,
      databaseBytes: (await database.query("SELECT pg_database_size(current_database())::float8 AS bytes")).rows[0]
        .bytes as number,
      objects: listed,
      expectedObjects,
      missingBlobMappings,
      unfinishedUploads,
      objectBytes: listed.reduce((sum, object) => sum + object.bytes, 0),
    };
  } finally {
    await database.end();
    objects.destroy();
  }
};
