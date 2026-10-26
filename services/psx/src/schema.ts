import { boolean, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

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
