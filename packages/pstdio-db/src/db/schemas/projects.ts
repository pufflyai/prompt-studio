import { pgTable, text } from "drizzle-orm/pg-core";
import { isoTimestamp } from "./iso-timestamp";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shorthand: text("shorthand").notNull(),
  default_agent_id: text("default_agent_id"),
  default_agent_model: text("default_agent_model"),
  startup_script: text("startup_script"),
  created_at: isoTimestamp("created_at").notNull(),
  updated_at: isoTimestamp("updated_at").notNull(),
  deleted_at: isoTimestamp("deleted_at"),
});
