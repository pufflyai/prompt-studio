import { jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { AssetReference } from "pstdio-api-contracts";
import { projects } from "./projects";

export const assetTransfers = pgTable(
  "asset_transfers",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    operation_id: text("operation_id").notNull(),
    expected: jsonb("expected").$type<AssetReference>().notNull(),
    cancelled_at: text("cancelled_at"),
    created_at: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.project_id, table.extension_id, table.operation_id] })],
);
