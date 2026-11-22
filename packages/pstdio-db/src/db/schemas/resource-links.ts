import { index, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { ResourceAnchor, ResourceRef, ResourceRole } from "pstdio-api-contracts/extension-kernel";
import { owners } from "./owners";

export const resource_links = pgTable(
  "resource_links",
  {
    source_owner: integer("source_owner")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    source_kind: text("source_kind").notNull(),
    source_id: text("source_id").notNull(),
    target_owner: integer("target_owner")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    target_kind: text("target_kind").notNull(),
    target_id: text("target_id").notNull(),
    role: text("role").$type<ResourceRole>().notNull().default("context"),
    details: jsonb("details")
      .$type<ResourceAnchor & { sourceRef?: Pick<ResourceRef, "label" | "icon" | "shorthand"> }>()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.source_owner,
        table.source_kind,
        table.source_id,
        table.target_owner,
        table.target_kind,
        table.target_id,
      ],
    }),
    index("resource_links_target_idx").on(
      table.target_owner,
      table.target_kind,
      table.target_id,
      table.source_owner,
      table.source_kind,
      table.source_id,
    ),
  ],
);
