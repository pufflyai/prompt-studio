import { fileURLToPath } from "node:url";
import { CreateBucketCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SQL } from "bun";
import { createRelayAssets, createRelayStorage, migrateRelayStorage } from "pstdio-relay";
import { type Asset, fingerprint, type Mutation, type Scope, type Snapshot } from "pstdio-sync-contracts";

export const createProductionRelayServices = async (databaseUrl: string, objectEndpoint: string) => {
  if (!databaseUrl || !objectEndpoint) throw new Error("Production conformance requires isolated service endpoints");
  const bucket = `relay-conformance-${crypto.randomUUID()}`;
  const config = {
    endpoint: objectEndpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: "conformance-access", secretAccessKey: "conformance-secret-only" },
  };
  const admin = new S3Client({ ...config, maxAttempts: 1 });
  const assets = createRelayAssets({ databaseUrl, bucket, s3: config });
  const faults = new SQL(databaseUrl);
  const objects = {
    async initialize() {
      await admin.send(new CreateBucketCommand({ Bucket: bucket }));
    },
    async put(scope: Scope, asset: Asset, bytes: Uint8Array) {
      const started = performance.now();
      if (await assets.complete(scope, asset)) {
        console.log(`Relay fixture reused verified asset: ${(performance.now() - started).toFixed(2)}ms`);
        return;
      }
      const id = crypto.randomUUID();
      const upload = await assets.begin(scope, id, asset);
      for (let offset = 0; offset < bytes.byteLength; offset += upload.partSize) {
        const part = bytes.slice(offset, offset + upload.partSize);
        await assets.writePart(scope, id, offset / upload.partSize + 1, {
          byteLength: part.byteLength,
          sha256: new Bun.CryptoHasher("sha256").update(part).digest("hex"),
          body: new Blob([part]).stream(),
        });
      }
      await assets.finish(scope, id);
      console.log(`Relay fixture streamed and verified asset: ${(performance.now() - started).toFixed(2)}ms`);
    },
    async get(scope: Scope, asset: Asset) {
      const stored = await assets.read(scope, asset);
      // The shared scenario API buffers only small fixture values; completion uses the production owner.
      return stored ? new Uint8Array(await new Response(stored.body).arrayBuffer()) : null;
    },
    async remove(scope: Scope, asset: Asset) {
      const rows = await faults`SELECT "objectKey" FROM relay_verified_assets
        WHERE "ownerId" = ${await fingerprint(scope)} AND reference = ${await fingerprint(asset)}`;
      for (const row of rows) await admin.send(new DeleteObjectCommand({ Bucket: bucket, Key: row.objectKey }));
    },
    close: () => admin.destroy(),
  };
  await objects.initialize();
  await migrateRelayStorage(databaseUrl, fileURLToPath(new URL("../drizzle/", import.meta.resolve("pstdio-relay"))));
  const storage = createRelayStorage(databaseUrl, assets);
  await faults`CREATE TABLE relay_test_commit_failures (operation_id text PRIMARY KEY)`;
  await faults`CREATE FUNCTION relay_test_fail_commit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM relay_test_commit_failures WHERE operation_id = NEW.id) THEN
        RAISE EXCEPTION 'crash before commit';
      END IF;
      RETURN NEW;
    END
  $$`;
  await faults`CREATE TRIGGER relay_test_before_commit BEFORE INSERT OR UPDATE ON relay_operations
    FOR EACH ROW EXECUTE FUNCTION relay_test_fail_commit()`;

  const owner = (scope: Scope) => storage.initialize(scope, "published-1");
  const relay = {
    snapshot: async (scope: Scope) => (await owner(scope)).snapshot(),
    async submit(mutation: Mutation, crash?: "before-commit" | "after-commit") {
      const target = await owner(mutation.scope);
      if (crash === "before-commit") {
        await faults`INSERT INTO relay_test_commit_failures VALUES (${mutation.operationId})`;
        try {
          await target.submit(mutation);
          throw new Error("Test failure trigger did not abort publication");
        } catch (cause) {
          throw new Error("crash before commit", { cause });
        } finally {
          await faults`DELETE FROM relay_test_commit_failures WHERE operation_id = ${mutation.operationId}`;
        }
      }
      const receipt = await target.submit(mutation);
      if (crash === "after-commit") throw new Error("crash after commit before acknowledgment");
      return receipt;
    },
    restore: async (snapshot: Snapshot) => (await owner(snapshot.scope)).restore(snapshot),
    async publish(scope: Scope, revision: string) {
      const target = await owner(scope);
      const current = await target.snapshot();
      await target.publishRevision(current.publishedRevision, revision);
    },
    close: storage.close,
  };
  return {
    relay,
    objects,
    async close() {
      await faults.close();
      await relay.close();
      await assets.close();
      objects.close();
    },
  };
};
