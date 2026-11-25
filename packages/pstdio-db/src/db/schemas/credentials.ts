import { index, jsonb, pgTable, text, unique } from "drizzle-orm/pg-core";
import { isoTimestamp } from "./iso-timestamp";
import { projects } from "./projects";
export type ExtensionConnectionCheck = { ok: boolean; status: number | null; error: string | null; checkedAt: string };

// Credentials belong to this person on this device, including when project configuration is shared.
// They remain until disconnected; project-scoped credentials leave with their project.
export const credentials = pgTable(
  "credentials",
  {
    id: text("id").primaryKey(),
    extension_id: text("extension_id").notNull(),
    contribution_id: text("contribution_id").notNull(),
    project_id: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    account_label: text("account_label"),
    auth_type: text("auth_type").$type<"bearer" | "header" | "oauth">().notNull(),
    auth_header_name: text("auth_header_name"),
    scopes: text("scopes").array().notNull().default([]),
    secret_ref: text("secret_ref").notNull(),
    expires_at: isoTimestamp("expires_at"),
    last_check: jsonb("last_check").$type<ExtensionConnectionCheck>(),
    created_at: isoTimestamp("created_at").notNull(),
    updated_at: isoTimestamp("updated_at").notNull(),
  },
  (table) => [
    unique("credentials_owner_uq").on(table.extension_id, table.contribution_id, table.project_id).nullsNotDistinct(),
    index("credentials_project_idx").on(table.project_id),
  ],
);
