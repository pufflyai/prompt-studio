import { boolean, foreignKey, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const extensionReleases = pgTable(
  "extension_releases",
  {
    extensionId: text("extension_id").notNull(),
    version: text("version").notNull(),
    enginesPstdio: text("engines_pstdio").notNull(),
    sha256: text("sha256").notNull(),
    withdrawn: boolean("withdrawn").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.extensionId, table.version] })],
);

export const extensionReleaseBundles = pgTable(
  "extension_release_bundles",
  {
    extensionId: text("extension_id").notNull(),
    version: text("version").notNull(),
    host: text("host").notNull(),
    sha256: text("sha256").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.extensionId, table.version, table.host] }),
    foreignKey({
      columns: [table.extensionId, table.version],
      foreignColumns: [extensionReleases.extensionId, extensionReleases.version],
    }).onDelete("cascade"),
  ],
);
