import { CreateBucketCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Pool } from "pg";
import { type Asset, fingerprint, publishedExtensionsId } from "pstdio-sync-contracts";
import { createAssetFixture, input, reference } from "../assets/integration-fixture";
import { sealStoredMutation } from "../storage/mutation.fixture";
import { createRelayStorage } from "../storage/storage";
import { createRelayBackupCatalog, createRelayBackupWorker } from "./worker";

export const createBackupFixture = async () => {
  const base = createAssetFixture();
  await base.initialize();
  const pool = new Pool({ connectionString: base.config.databaseUrl });
  await pool.query("TRUNCATE relay_scopes, relay_asset_uploads, relay_asset_parts, relay_verified_assets CASCADE");
  const backup = { bucket: `backups-${crypto.randomUUID()}`, s3: base.config.s3 };
  await base.client.send(new CreateBucketCommand({ Bucket: backup.bucket }));
  const assets = base.owner();
  const storage = createRelayStorage(base.config.databaseUrl, assets);
  const config = { databaseUrl: base.config.databaseUrl, live: base.config, backup };
  const resources: { close(): Promise<unknown> | unknown }[] = [storage, assets];
  const put = async (
    scope: { accountId: string; workbenchId: string; extensionId: string },
    bytes: Uint8Array,
    mediaType = "image/png",
  ) => {
    const id = crypto.randomUUID();
    const asset = { ...reference(bytes), mediaType };
    const upload = await assets.begin(scope, id, asset);
    for (let offset = 0; offset < bytes.length; offset += upload.partSize)
      await assets.writePart(
        scope,
        id,
        offset / upload.partSize + 1,
        input(bytes.slice(offset, offset + upload.partSize)),
      );
    await assets.finish(scope, id);
    return asset;
  };
  const populate = async (byteLength = 1000) => {
    const scope = { accountId: "backup-owner", workbenchId: crypto.randomUUID(), extensionId: "example.tool" };
    const catalogScope = { ...scope, extensionId: publishedExtensionsId };
    const catalog = await storage.initialize(catalogScope, "published-extensions-v1");
    const packageBytes = new TextEncoder().encode(
      JSON.stringify({
        version: 1,
        files: [
          {
            path: "package.json",
            bytes: Buffer.from(
              JSON.stringify({ name: "example.tool", version: "1.0.0", main: "extension.ts" }),
            ).toString("base64"),
            executable: false,
          },
          { path: "extension.ts", bytes: Buffer.from("export default {};").toString("base64"), executable: false },
        ],
      }),
    );
    const packageAsset = await put(catalogScope, packageBytes, "application/vnd.pstdio.extension+json");
    await catalog.submit(
      await sealStoredMutation({
        protocolVersion: 2,
        scope: catalogScope,
        operationId: "publish",
        environmentId: "publisher",
        parents: [],
        changes: [
          {
            recordId: scope.extensionId,
            expectedRevision: 0,
            baseDeleted: false,
            value: {
              expected: await fingerprint(null),
              next: {
                extensionId: scope.extensionId,
                revision: packageAsset.sha256,
                automation: false,
                enabled: true,
              },
            },
            asset: { base: null, next: packageAsset },
          },
        ],
      }),
    );
    const owner = await storage.initialize(scope, packageAsset.sha256);
    const bytes = new Uint8Array(byteLength).fill(91);
    const asset = await put(scope, bytes);
    await owner.submit(
      await sealStoredMutation({
        protocolVersion: 2,
        scope,
        operationId: "record",
        environmentId: "writer",
        parents: [],
        changes: [
          {
            recordId: "record",
            expectedRevision: 0,
            baseDeleted: false,
            value: { expected: await fingerprint(null), next: { title: "Backed up" } },
            asset: { base: null, next: asset },
            shared: {
              kind: "map",
              entries: [
                {
                  key: "setting",
                  expected: await fingerprint({ exists: false, value: null }),
                  next: { kind: "set", value: "retained" },
                },
              ],
            },
          },
        ],
      }),
    );
    return { scope, catalogScope, owner, bytes, asset, packageAsset, packageBytes };
  };
  const list = async (bucket: string, prefix = "") => {
    const result = await base.client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
    return result.Contents ?? [];
  };
  return {
    base,
    pool,
    assets,
    storage,
    config,
    backup,
    put,
    populate,
    list,
    worker(override = config) {
      const worker = createRelayBackupWorker(override);
      resources.push(worker);
      return worker;
    },
    catalog() {
      const catalog = createRelayBackupCatalog(backup);
      resources.push(catalog);
      return catalog;
    },
    async pins() {
      return (await pool.query("SELECT * FROM relay_captures")).rows;
    },
    async removeLive() {
      for (const object of await list(base.config.bucket))
        await base.client.send(new DeleteObjectCommand({ Bucket: base.config.bucket, Key: object.Key }));
    },
    async close() {
      await Promise.allSettled(resources.map((resource) => resource.close()));
      await pool.end();
      base.close();
    },
  };
};
export const assetBytes = async (body: ReadableStream<Uint8Array>) =>
  new Uint8Array(await new Response(body).arrayBuffer());
export type BackupFixture = Awaited<ReturnType<typeof createBackupFixture>>;
export type { Asset };
