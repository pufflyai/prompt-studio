import { sql } from "drizzle-orm";
import { check, pgTable, text } from "drizzle-orm/pg-core";

// The database is owned by one local environment. Workspace and session rows already
// belong to this database, so they do not each need another environment column.
export const local_environment = pgTable(
  "local_environment",
  {
    id: text("id").primaryKey(),
    environment_id: text("environment_id").notNull(),
  },
  (table) => [check("local_environment_single_owner", sql`${table.id} = 'local'`)],
);
