import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("anchor migration keeps known owners, last repeated pairs, roles and relationship metadata", async () => {
  const db = new PGlite();
  try {
    await db.waitReady;
    await db.exec(`CREATE TABLE projects (id text PRIMARY KEY);
      CREATE TABLE workspaces (id text PRIMARY KEY, project_id text, anchors_json jsonb NOT NULL);
      CREATE TABLE sessions (id text PRIMARY KEY, project_id text, anchors_json jsonb NOT NULL);
      INSERT INTO projects VALUES ('project');`);
    const anchors = [
      { type: "ticket", id: "ticket", role: "primary", label: "Old" },
      { type: "ticket", id: "ticket", role: "result", metadata: { phase: "review", revision: 2 } },
      { type: "planner-attempt", id: "attempt", role: "context" },
      { type: "planner-review", id: "review", role: "source" },
      { type: "session", id: "session", role: "primary" },
      { type: "item", id: "same", extensionId: "example.one" },
      { type: "item", id: "same", extensionId: "example.two" },
      { type: "unknown", id: "drop" },
      { type: "ticket", id: "foreign", projectId: "foreign" },
    ];
    for (const table of ["workspaces", "sessions"])
      await db.query(`INSERT INTO ${table} VALUES ($1, 'project', $2)`, [table, JSON.stringify(anchors)]);
    await db.exec(readFileSync(new URL("../../drizzle/0037_nebulous_galactus.sql", import.meta.url), "utf8"));
    const { rows } = await db.query<{
      source_kind: string;
      target_owner: string;
      target_kind: string;
      target_id: string;
      role: string;
      details: unknown;
    }>("SELECT * FROM resource_anchors");
    expect(rows).toHaveLength(12);
    for (const source_kind of ["workspace", "session"]) {
      expect(rows).toContainEqual(
        expect.objectContaining({
          source_kind,
          target_owner: "pstdio.pstdio-planner",
          target_id: "ticket",
          role: "result",
          details: anchors[1],
        }),
      );
      expect(
        rows
          .filter((row) => row.source_kind === source_kind && row.target_id === "same")
          .map((row) => row.target_owner)
          .sort(),
      ).toEqual(["example.one", "example.two"]);
      expect(new Set(rows.filter((row) => row.source_kind === source_kind).map((row) => row.role))).toEqual(
        new Set(["primary", "context", "source", "result"]),
      );
    }
  } finally {
    await db.close();
  }
});
