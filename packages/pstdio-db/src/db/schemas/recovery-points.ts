import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, index, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { owners } from "./owners";
import { projects } from "./projects";
import { bytea } from "./types";

// One row per kept recovery point. The fixed slots keep at most three points per project.
export const recovery_points = pgTable(
  "recovery_points",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    hours: integer("hours").notNull(),
    captured_at: text("captured_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.project_id, table.hours] }),
    check("recovery_points_hours", sql`${table.hours} in (1, 12, 24)`),
  ],
);

// One extension's saved data in a recovery point.
export const recovery_point_owners = pgTable(
  "recovery_point_owners",
  {
    project_id: text("project_id").notNull(),
    hours: integer("hours").notNull(),
    owner_id: integer("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    // The owner revision the records were read at. An unchanged revision reuses the saved records.
    revision: bigint("revision", { mode: "number" }).notNull(),
    // Gzipped JSON of the owner's live records, read from the current-record projection.
    records: bytea("records").notNull(),
    // Gzipped JSON of the owner's text documents and data migration markers.
    metadata: bytea("metadata").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.project_id, table.hours, table.owner_id] }),
    index("recovery_owner_revision").on(table.owner_id, table.revision),
    foreignKey({
      columns: [table.project_id, table.hours],
      foreignColumns: [recovery_points.project_id, recovery_points.hours],
    }).onDelete("cascade"),
  ],
);
