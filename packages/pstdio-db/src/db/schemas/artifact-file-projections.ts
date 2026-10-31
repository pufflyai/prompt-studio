import { jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { ArtifactFileProjection } from "pstdio-api-contracts";

export const artifact_file_projection_roots = pgTable("artifact_file_projection_roots", {
  key: text("projection_key").primaryKey(),
});

export const artifact_file_projections = pgTable(
  "artifact_file_projections",
  {
    key: text("projection_key")
      .notNull()
      .references(() => artifact_file_projection_roots.key, { onDelete: "cascade" }),
    path: text("path").notNull(),
    state: jsonb("state").$type<ArtifactFileProjection[string]>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.key, table.path] })],
);
