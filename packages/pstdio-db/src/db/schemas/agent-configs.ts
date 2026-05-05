import { boolean, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const agent_configs = pgTable(
  "agent_configs",
  {
    id: text("id").primaryKey(),
    agent_id: text("agent_id").notNull(),
    is_default: boolean("is_default").notNull().default(false),
    config: text("config").notNull().default("{}"),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("agent_configs_agent_id_idx").on(table.agent_id)],
);
