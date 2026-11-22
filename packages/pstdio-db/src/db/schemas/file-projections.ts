import { sql } from "drizzle-orm";
import { bigint, foreignKey, index, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { ArtifactFileProjection } from "pstdio-api-contracts";
import { documents } from "./documents";
import { owners } from "./owners";

export const file_projections = pgTable(
  "file_projections",
  {
    owner_id: integer("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    root: text("root").notNull(),
    path: text("path").notNull(),
    document_id: bigint("document_id", { mode: "number" }),
    state: jsonb("state").$type<ArtifactFileProjection[string]>(),
    baseline_sha256: text("baseline_sha256"),
    baseline_bytes: bigint("baseline_bytes", { mode: "number" }),
    pending_sha256: text("pending_sha256"),
    pending_bytes: bigint("pending_bytes", { mode: "number" }),
    completed_revision: bigint("completed_revision", { mode: "number" }).notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.owner_id, table.root, table.path] }),
    index("file_projections_document").on(table.owner_id, table.document_id),
    index("file_projections_native_pending")
      .on(table.owner_id, table.path)
      .where(sql`${table.root}='["native","handler"]'`),
    foreignKey({
      columns: [table.owner_id, table.document_id],
      foreignColumns: [documents.owner_id, documents.id],
    }).onDelete("cascade"),
  ],
);
