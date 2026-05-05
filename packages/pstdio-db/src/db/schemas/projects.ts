import { pgTable, text } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shorthand: text("shorthand").notNull(),
  selected_agents: text("selected_agents").notNull().default("[]"),
  default_agent_id: text("default_agent_id"),
  default_agent_model: text("default_agent_model"),
  startup_script: text("startup_script"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});
