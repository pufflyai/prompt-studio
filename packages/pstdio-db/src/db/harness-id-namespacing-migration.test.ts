import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { createDb } from "./connection.pglite";

// The shipped 0020 migration both drops the legacy agent-config storage and rewrites
// the bare legacy agent ids that remain on sessions and project defaults. The drops are
// applied by migrate() on connect, so this exercises the data rewrites directly and
// verifies the dropped structures are gone.
const dataStatements = fs
  .readFileSync(path.join(import.meta.dir, "../../drizzle/0020_harness_id_namespacing.sql"), "utf8")
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter((statement) => statement.startsWith("UPDATE"));

const runDataRewrites = async (db: Awaited<ReturnType<typeof createDb>>["db"]) => {
  for (const statement of dataStatements) {
    await db.execute(sql.raw(statement));
  }
};

describe("0020_harness_id_namespacing", () => {
  it("drops legacy agent-config storage and rewrites bare ids to namespaced harness ids", async () => {
    const client = await createDb({ path: ":memory:" });
    const { db } = client;

    const tables = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'agent_configs'`,
    );
    expect(tables.rows).toEqual([]);

    const columns = await db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'selected_agents'`,
    );
    expect(columns.rows).toEqual([]);

    const now = new Date().toISOString();
    await db.execute(sql`
      INSERT INTO projects (id, name, shorthand, default_agent_id, created_at, updated_at)
      VALUES ('p-1', 'P', 'P', 'claude-code', ${now}, ${now})
    `);
    await db.execute(sql`
      INSERT INTO sessions (id, title, status, agent, created_at, updated_at)
      VALUES ('s-1', 'S', 'in_progress', 'fake', ${now}, ${now}),
             ('s-2', 'S2', 'completed', 'pstdio.harness-open-code.harness.opencode', ${now}, ${now}),
             ('s-3', 'S3', 'completed', 'acme.acme-agent.my-agent', ${now}, ${now})
    `);

    // Run twice: the rewrites only match exact bare ids, so re-running is a no-op.
    await runDataRewrites(db);
    await runDataRewrites(db);

    const projects = await db.execute(sql`SELECT default_agent_id FROM projects`);
    expect(projects.rows).toEqual([{ default_agent_id: "pstdio.harness-claude-code.harness.claude-code" }]);

    const sessions = await db.execute(sql`SELECT id, agent FROM sessions ORDER BY id`);
    expect(sessions.rows).toEqual([
      { id: "s-1", agent: "pstdio.harness-lab.fake" },
      { id: "s-2", agent: "pstdio.harness-open-code.harness.opencode" },
      { id: "s-3", agent: "acme.acme-agent.my-agent" },
    ]);

    await client.close();
  });
});
