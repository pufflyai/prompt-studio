import { pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { bytea } from "./types";

export const ydocUpdates = pgTable("ydoc_updates", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  room: text("room").notNull(),
  op: bytea("op").notNull(),
});

export const ydocAwareness = pgTable(
  "ydoc_awareness",
  {
    clientId: text("client_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    room: text("room").notNull(),
    op: bytea("op").notNull(),
    updated: text("updated").notNull(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.room, t.projectId] })],
);

export const ydocResumeState = pgTable(
  "ydoc_resume_state",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    room: text("room").notNull(),
    offset: text("offset").notNull(),
    handle: text("handle").notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.room] })],
);
