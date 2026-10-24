import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { bytea } from "./types";

// One row per kept recovery point. The fixed slots keep at most three points per project.
export const recovery_points = pgTable(
  "recovery_points",
  {
    workbench_id: text("workbench_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    hours: integer("hours").notNull(),
    captured_at: text("captured_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workbench_id, table.hours] }),
    check("recovery_points_hours", sql`${table.hours} in (1, 12, 24)`),
  ],
);

// One extension's saved data in a recovery point.
export const recovery_point_owners = pgTable(
  "recovery_point_owners",
  {
    workbench_id: text("workbench_id").notNull(),
    hours: integer("hours").notNull(),
    extension_id: text("extension_id").notNull(),
    // The owner revision the records were read at. An unchanged revision reuses the saved records.
    revision: bigint("revision", { mode: "number" }).notNull(),
    // Gzipped JSON of the owner's live records, read from the current-record projection.
    records: bytea("records").notNull(),
    // Gzipped JSON of the owner's text documents and data migration markers.
    metadata: bytea("metadata").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workbench_id, table.hours, table.extension_id] }),
    foreignKey({
      columns: [table.workbench_id, table.hours],
      foreignColumns: [recovery_points.workbench_id, recovery_points.hours],
    }).onDelete("cascade"),
  ],
);
