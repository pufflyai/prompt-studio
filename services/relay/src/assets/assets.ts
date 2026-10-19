import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { type Asset, assetSchema, canonicalJson, fingerprint, identitySchema } from "pstdio-sync-contracts";
import { completeUpload } from "./completion";
import { createAssetDatabase } from "./database";
import { createAssetObjects, type ObjectConfig } from "./objects";
import { createAssetOperations } from "./operations";
import { type AssetOwner, assetOwnerSchema } from "./owner";
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
  const identity = async (owner: AssetOwner, id: string) => ({
    ownerId: await fingerprint(assetOwnerSchema.parse(owner)),
    id: identitySchema.parse(id),
  });
  const uploadWhere = (key: { ownerId: string; id: string }) =>
    and(eq(assetUploads.ownerId, key.ownerId), eq(assetUploads.id, key.id));
  const partWhere = (key: { ownerId: string; id: string }) =>
    and(eq(assetParts.ownerId, key.ownerId), eq(assetParts.uploadId, key.id));
  const lockKey = (key: { ownerId: string; id: string }) =>
    new Bun.CryptoHasher("sha256").update(canonicalJson(key)).digest("hex");
  const withUpload = async <T>(
    owner: AssetOwner,
    id: string,
    controller: AbortController,
    action: (context: {
      db: NodePgDatabase;
      key: { ownerId: string; id: string };
      row: typeof assetUploads.$inferSelect;
      signal: AbortSignal;
    }) => Promise<T>,
  ) => {
    const key = await identity(owner, id);
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
  const verified = async (owner: AssetOwner, asset: Asset, db: NodePgDatabase, signal: AbortSignal) => {
    const ownerId = await fingerprint(assetOwnerSchema.parse(owner));
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
    async begin(owner: AssetOwner, id: string, input: Asset) {
      return operations.run(async (controller) => {
        const asset = assetSchema.parse(input);
        const key = await identity(owner, id);
        await database.run(
          async (db) =>
            db
              .insert(assetUploads)
              .values({
                ...key,
                asset,
                objectKey: `assets/${key.ownerId}/${await fingerprint(key.id)}`,
                partSize: multipartSize(asset.byteLength),
                status: "open",
              })
              .onConflictDoNothing(),
          controller.signal,
        );
        return withUpload(owner, id, controller, async ({ db, row, signal }) => {
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
    async writePart(owner: AssetOwner, id: string, number: number, input: PartInput) {
      return operations.run(
        (controller) =>
          withUpload(owner, id, controller, ({ db, row, signal }) =>
            writeUploadPart(db, row, number, input, objects, signal),
          ),
        input.signal,
        () => input.body.cancel().catch(() => {}),
      );
    },
    async finish(owner: AssetOwner, id: string) {
      return operations.run((controller) =>
        withUpload(owner, id, controller, async ({ db, row, signal }) => {
          if (row.status === "completed") {
            if (!(await verified(owner, row.asset, db, signal))) throw new Error("Verified asset bytes are incomplete");
            return row.asset;
          }
          return completeUpload(db, row, objects, signal);
        }),
      );
    },
    async complete(owner: AssetOwner, asset: Asset, requestSignal?: AbortSignal) {
      return operations.run(
        ({ signal }) => database.run(async (db) => (await verified(owner, asset, db, signal)) !== null, signal),
        requestSignal,
      );
    },
    async read(owner: AssetOwner, asset: Asset, offset = 0, requestSignal?: AbortSignal) {
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > asset.byteLength)
        throw new Error("Invalid asset offset");
      return operations.run(async ({ signal }) => {
        const combined = requestSignal ? AbortSignal.any([signal, requestSignal]) : signal;
        const row = await database.run((db) => verified(owner, asset, db, combined), combined);
        if (!row) return null;
        if (offset === asset.byteLength && offset > 0)
          return {
            asset: row.asset,
            body: new ReadableStream<Uint8Array>({
              start(controller) {
                controller.close();
              },
            }),
          };
        const source =
          offset === 0
            ? await objects.get(row.objectKey, row.etag, combined)
            : await objects.range(row.objectKey, row.etag, row.asset, offset, combined);
        // A suffix cannot prove the full digest. The receiver verifies its complete assembled file.
        const body = checkedStream(
          source,
          offset === 0 ? row.asset : { byteLength: row.asset.byteLength - offset },
          requestSignal,
        );
        return { asset: row.asset, body };
      }, requestSignal);
    },
    async cancel(owner: AssetOwner, id: string) {
      return operations.run(async ({ signal }) => {
        const key = await identity(owner, id);
        const cancelled = await database.run(
          (db) =>
            db.transaction(async (db) => {
              const rows = await db
                .update(assetUploads)
                .set({ status: "cancelled" })
                .where(and(uploadWhere(key), inArray(assetUploads.status, ["open", "cancelled"])))
                .returning({ id: assetUploads.id });
              if (!rows.length) return false;
              await db.execute(sql`SELECT pg_notify('relay_asset_cancel', ${lockKey(key)})`);
              return true;
            }),
          signal,
        );
        if (!cancelled) return;
        active.get(lockKey(key))?.abort(new Error("Asset upload was cancelled"));
        await database.lock(lockKey(key), signal, async (db) => {
          const row = (await db.select().from(assetUploads).where(uploadWhere(key)))[0];
          if (row?.status !== "cancelled") return;
          await objects.discard(row.objectKey, row.multipartId, signal);
          await objects.remove(row.objectKey, signal);
          await db.delete(assetParts).where(partWhere(key));
        });
      });
    },
    /** Removes an upload, its bytes and its verified mapping. Removing a missing upload does nothing. */
    async remove(owner: AssetOwner, id: string) {
      return operations.run(async ({ signal }) => {
        const key = await identity(owner, id);
        await database.lock(lockKey(key), signal, async (db) => {
          const row = (await db.select().from(assetUploads).where(uploadWhere(key)))[0];
          if (!row) return;
          await objects.discard(row.objectKey, row.multipartId, signal);
          await objects.remove(row.objectKey, signal);
          await db.transaction(async (transaction) => {
            await transaction.delete(assetParts).where(partWhere(key));
            await transaction
              .delete(verifiedAssets)
              .where(and(eq(verifiedAssets.ownerId, key.ownerId), eq(verifiedAssets.objectKey, row.objectKey)));
            await transaction.delete(assetUploads).where(uploadWhere(key));
          });
        });
      });
    },
    close: operations.close,
  };
};
