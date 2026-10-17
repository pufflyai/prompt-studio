import { bigint, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { Asset } from "pstdio-sync-contracts";

export const assetUploads = pgTable(
  "relay_asset_uploads",
  {
    ownerId: text().notNull(),
    id: text().notNull(),
    asset: jsonb().$type<Asset>().notNull(),
    objectKey: text().notNull(),
    partSize: bigint({ mode: "number" }).notNull(),
    multipartId: text(),
    status: text({ enum: ["open", "cancelled", "completed"] }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.id] })],
);

export const assetParts = pgTable(
  "relay_asset_parts",
  {
    ownerId: text().notNull(),
    uploadId: text().notNull(),
    number: integer().notNull(),
    sha256: text().notNull(),
    byteLength: bigint({ mode: "number" }).notNull(),
    etag: text(),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.uploadId, table.number] })],
);

export const verifiedAssets = pgTable(
  "relay_verified_assets",
  {
    ownerId: text().notNull(),
    reference: text().notNull(),
    asset: jsonb().$type<Asset>().notNull(),
    objectKey: text().notNull(),
    etag: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.reference] })],
);
