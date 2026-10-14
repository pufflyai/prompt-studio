import { jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const webview_preferences = pgTable(
  "webview_preferences",
  {
    extension_id: text("extension_id").notNull(),
    name: text("name").notNull(),
    scope_type: text("scope_type").notNull(),
    scope_id: text("scope_id").notNull(),
    value_json: jsonb("value_json").$type<unknown>().notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.extension_id, table.name, table.scope_type, table.scope_id] })],
);
