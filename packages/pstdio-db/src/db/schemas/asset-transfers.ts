import { integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { AssetReference } from "pstdio-api-contracts";
import { isoTimestamp } from "./iso-timestamp";
import { owners } from "./owners";

export const assetTransfers = pgTable(
  "asset_transfers",
  {
    owner_id: integer("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    operation_id: text("operation_id").notNull(),
    expected: jsonb("expected").$type<AssetReference>().notNull(),
    cancelled_at: isoTimestamp("cancelled_at"),
    created_at: isoTimestamp("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.owner_id, table.operation_id] })],
);
