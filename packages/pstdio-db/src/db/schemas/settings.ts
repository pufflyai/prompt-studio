import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  id: text("id").primaryKey().default("global"),
  max_concurrent_sessions: integer("max_concurrent_sessions"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});
