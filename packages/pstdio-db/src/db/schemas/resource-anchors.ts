import { index, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { ResourceAnchor, ResourceRole } from "pstdio-api-contracts/extension-kernel";
import { projects } from "./projects";

export const resource_anchors = pgTable(
  "resource_anchors",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    source_owner: text("source_owner").notNull(),
    source_kind: text("source_kind").notNull(),
    source_id: text("source_id").notNull(),
    target_owner: text("target_owner").notNull(),
    target_kind: text("target_kind").notNull(),
    target_id: text("target_id").notNull(),
    role: text("role").$type<ResourceRole>().notNull().default("context"),
    details: jsonb("details").$type<ResourceAnchor>().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.project_id,
        table.source_owner,
        table.source_kind,
        table.source_id,
        table.target_owner,
        table.target_kind,
        table.target_id,
      ],
    }),
    index("resource_anchors_target_idx").on(
      table.project_id,
      table.target_owner,
      table.target_kind,
      table.target_id,
      table.source_owner,
      table.source_kind,
      table.source_id,
    ),
  ],
);
