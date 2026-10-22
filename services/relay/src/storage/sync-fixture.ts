import { resolve } from "node:path";
import { CreateBucketCommand, GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { Client } from "pg";
import { createRelayAssets } from "../assets/assets";
import { defaultRelayLimits, type RelayLimits } from "../limits";
import { migrateRelayStorage } from "./database";
import { createRelaySync } from "./sync";

export const randomId = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
export const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
export const sha256 = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
export const body = (bytes: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

/** Real PostgreSQL and object storage for the blind document store. Run through the isolated runner. */
export const createSyncFixture = () => {
  const databaseUrl = process.env.SYNC_TEST_DATABASE_URL!;
  const endpoint = process.env.SYNC_TEST_OBJECT_ENDPOINT!;
  if (!databaseUrl || !endpoint) throw new Error("Run through the isolated conformance runner");
  const bucket = `relay-sync-${crypto.randomUUID()}`;
  const s3 = {
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: "conformance-access", secretAccessKey: "conformance-secret-only" },
  };
  const client = new S3Client({ ...s3, maxAttempts: 1 });
  const owners: { close(): Promise<void> }[] = [];
  return {
    bucket,
    s3,
    databaseUrl,
    async initialize() {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      await migrateRelayStorage(databaseUrl, resolve(import.meta.dir, "../../drizzle"));
    },
    open(limits: Partial<RelayLimits> = {}) {
      const assets = createRelayAssets({ databaseUrl, bucket, s3 });
      const sync = createRelaySync({ databaseUrl, bucket, s3, assets, limits: { ...defaultRelayLimits, ...limits } });
      owners.push(sync, assets);
      return { sync, assets };
    },
    /** Every object key and its bytes in this run's bucket. */
    async objects() {
      const objects = new Map<string, Uint8Array>();
      let ContinuationToken: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken }));
        for (const { Key } of page.Contents ?? []) {
          const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key }));
          objects.set(Key!, await object.Body!.transformToByteArray());
        }
        ContinuationToken = page.NextContinuationToken;
      } while (ContinuationToken);
      return objects;
    },
    /** Total size of every object in this run's bucket. */
    async storedBytes() {
      let total = 0;
      let ContinuationToken: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken }));
        for (const { Size } of page.Contents ?? []) total += Size ?? 0;
        ContinuationToken = page.NextContinuationToken;
      } while (ContinuationToken);
      return total;
    },
    /** Every row of every relay table, as text. */
    async rows() {
      const pg = new Client({ connectionString: databaseUrl });
      await pg.connect();
      try {
        const tables = await pg.query<{ name: string }>(
          "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public'",
        );
        const rows: string[] = [];
        for (const { name } of tables.rows) {
          const result = await pg.query<{ row: string }>(`SELECT t::text AS row FROM "${name}" t`);
          rows.push(...result.rows.map((entry) => `${name} ${entry.row}`));
        }
        return rows;
      } finally {
        await pg.end();
      }
    },
    async close() {
      await Promise.all(owners.map((owner) => owner.close()));
      client.destroy();
    },
  };
};
