import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  type Asset,
  assetSchema,
  canonicalJson,
  fingerprint,
  identitySchema,
  type Scope,
  scopeSchema,
} from "pstdio-sync-contracts";
import { completeUpload } from "./completion";
import { createAssetDatabase } from "./database";
import { createAssetObjects, type ObjectConfig } from "./objects";
import { createAssetOperations } from "./operations";
import { assetParts, assetUploads, verifiedAssets } from "./schema";
import { checkedStream, multipartSize, type PartInput } from "./streams";
import { writeUploadPart } from "./upload-part";

export interface AssetConfig extends ObjectConfig {
  databaseUrl: string;
}

export const createRelayAssets = (config: AssetConfig) => {
  const objects = createAssetObjects(config);
  const active = new Map<string, AbortController>();
  const operations = createAssetOperations(
    () => database.ready(),
    async () => {
      objects.close();
      await database.close();
    },
  );
  const database = createAssetDatabase(
    config.databaseUrl,
    (key) => active.get(key)?.abort(new Error("Asset upload was cancelled")),
    (reason) => operations.abort(reason),
  );
  const identity = async (scope: Scope, id: string) => ({
    ownerId: await fingerprint(scopeSchema.parse(scope)),
    id: identitySchema.parse(id),
  });
  const uploadWhere = (key: { ownerId: string; id: string }) =>
    and(eq(assetUploads.ownerId, key.ownerId), eq(assetUploads.id, key.id));
  const partWhere = (key: { ownerId: string; id: string }) =>
    and(eq(assetParts.ownerId, key.ownerId), eq(assetParts.uploadId, key.id));
  const lockKey = (key: { ownerId: string; id: string }) =>
    new Bun.CryptoHasher("sha256").update(canonicalJson(key)).digest("hex");
  const withUpload = async <T>(
    scope: Scope,
    id: string,
    controller: AbortController,
    action: (context: {
      db: NodePgDatabase;
      key: { ownerId: string; id: string };
      row: typeof assetUploads.$inferSelect;
      signal: AbortSignal;
    }) => Promise<T>,
  ) => {
    const key = await identity(scope, id);
    return database.lock(lockKey(key), controller.signal, async (db) => {
      active.set(lockKey(key), controller);
      try {
        const row = (await db.select().from(assetUploads).where(uploadWhere(key)))[0];
        if (!row) throw new Error("Unknown asset upload");
        if (row.status === "cancelled") throw new Error("Asset upload was cancelled");
        controller.signal.throwIfAborted();
        return await action({ db, key, row, signal: controller.signal });
      } finally {
        active.delete(lockKey(key));
      }
    });
  };
  const verified = async (scope: Scope, asset: Asset, db: NodePgDatabase = database.db, signal?: AbortSignal) => {
    const ownerId = await fingerprint(scopeSchema.parse(scope));
    const reference = await fingerprint(assetSchema.parse(asset));
    const row = (
      await db
        .select()
        .from(verifiedAssets)
        .where(and(eq(verifiedAssets.ownerId, ownerId), eq(verifiedAssets.reference, reference)))
    )[0];
    if (!row) return null;
    const metadata = await objects.head(row.objectKey, row.etag, signal);
    return metadata?.ContentLength === asset.byteLength && metadata.ContentType === asset.mediaType ? row : null;
  };
  return {
    async begin(scope: Scope, id: string, input: Asset) {
      return operations.run(async (controller) => {
        const asset = assetSchema.parse(input);
        const key = await identity(scope, id);
        await database.db
          .insert(assetUploads)
          .values({
            ...key,
            asset,
            objectKey: `assets/${key.ownerId}/${await fingerprint(key.id)}`,
            partSize: multipartSize(asset.byteLength),
            status: "open",
          })
          .onConflictDoNothing();
        return withUpload(scope, id, controller, async ({ db, row, signal }) => {
          if (canonicalJson(row.asset) !== canonicalJson(asset))
            throw new Error("Upload identity reused with changed asset");
          let multipartId = row.multipartId;
          if (row.status === "open" && asset.byteLength > 0 && !multipartId) {
            multipartId = await objects.begin(row.objectKey, asset, signal);
            await db.update(assetUploads).set({ multipartId }).where(uploadWhere(key));
          }
          const parts = await db.select().from(assetParts).where(partWhere(key)).orderBy(asc(assetParts.number));
          return { asset: row.asset, partSize: row.partSize, completed: row.status === "completed", parts };
        });
      });
    },
    async writePart(scope: Scope, id: string, number: number, input: PartInput) {
      return operations.run(
        (controller) =>
          withUpload(scope, id, controller, ({ db, row, signal }) =>
            writeUploadPart(db, row, number, input, objects, signal),
          ),
        input.signal,
        () => input.body.cancel().catch(() => {}),
      );
    },
    async finish(scope: Scope, id: string) {
      return operations.run((controller) =>
        withUpload(scope, id, controller, async ({ db, row, signal }) => {
          if (row.status === "completed") {
            if (!(await verified(scope, row.asset, db, signal))) throw new Error("Verified asset bytes are incomplete");
            return row.asset;
          }
          return completeUpload(db, row, objects, signal);
        }),
      );
    },
    async complete(scope: Scope, asset: Asset) {
      return operations.run(async ({ signal }) => (await verified(scope, asset, database.db, signal)) !== null);
    },
    async read(scope: Scope, asset: Asset) {
      return operations.run(async ({ signal }) => {
        const row = await verified(scope, asset, database.db, signal);
        if (!row) return null;
        const body = checkedStream(await objects.get(row.objectKey, row.etag, signal), row.asset);
        return { asset: row.asset, body };
      });
    },
    async cancel(scope: Scope, id: string) {
      return operations.run(async ({ signal }) => {
        const key = await identity(scope, id);
        const cancelled = await database.db.transaction(async (db) => {
          const rows = await db
            .update(assetUploads)
            .set({ status: "cancelled" })
            .where(and(uploadWhere(key), inArray(assetUploads.status, ["open", "cancelled"])))
            .returning({ id: assetUploads.id });
          if (!rows.length) return false;
          await db.execute(sql`SELECT pg_notify('relay_asset_cancel', ${lockKey(key)})`);
          return true;
        });
        if (!cancelled) return;
        active.get(lockKey(key))?.abort(new Error("Asset upload was cancelled"));
        await database.lock(lockKey(key), signal, async (db) => {
          const row = (await db.select().from(assetUploads).where(uploadWhere(key)))[0];
          if (row?.status !== "cancelled") return;
          await objects.discard(row.objectKey, row.multipartId);
          await objects.remove(row.objectKey);
          await db.delete(assetParts).where(partWhere(key));
        });
      });
    },
    close: operations.close,
  };
};
