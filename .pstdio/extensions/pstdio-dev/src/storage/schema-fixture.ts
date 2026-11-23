import type { DatabaseSchema } from "../diagnostics/schema";

export const schemaFixture: DatabaseSchema = {
  source: "packages/pstdio-db/drizzle/meta/0004_snapshot.json",
  tables: [
    {
      id: "public.projects",
      schema: "public",
      name: "projects",
      columns: [
        { name: "id", type: "text", nullable: false, primaryKey: true, default: null, values: [] },
        { name: "name", type: "text", nullable: false, primaryKey: false, default: null, values: [] },
      ],
      indexes: [],
      foreignKeys: [],
    },
    {
      id: "public.sessions",
      schema: "public",
      name: "sessions",
      columns: [
        { name: "id", type: "text", nullable: false, primaryKey: true, default: null, values: [] },
        { name: "project_id", type: "text", nullable: true, primaryKey: false, default: null, values: [] },
        {
          name: "status",
          type: "session_status",
          nullable: false,
          primaryKey: false,
          default: "'in_progress'",
          values: ["in_progress", "completed", "failed"],
        },
      ],
      indexes: [{ name: "sessions_project_idx", columns: ["project_id"], unique: false, method: "btree" }],
      foreignKeys: [
        {
          name: "sessions_project_id_fk",
          columns: ["project_id"],
          target: "public.projects",
          targetColumns: ["id"],
          onDelete: "cascade",
          onUpdate: "no action",
        },
      ],
    },
  ],
};
