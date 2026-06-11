import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { createDb } from "./connection.pglite";

const migrationStatements = fs
  .readFileSync(path.join(import.meta.dir, "../../drizzle/0020_harness_id_namespacing.sql"), "utf8")
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean);

const runMigration = async (db: Awaited<ReturnType<typeof createDb>>["db"]) => {
  for (const statement of migrationStatements) {
    await db.execute(sql.raw(statement));
  }
};

describe("0020_harness_id_namespacing", () => {
  it("rewrites bare agent ids to namespaced harness ids and is idempotent", async () => {
    const client = await createDb({ path: ":memory:" });
    const { db } = client;

    const now = new Date().toISOString();
    await db.execute(sql`
      INSERT INTO agent_configs (id, agent_id, is_default, config, created_at, updated_at)
      VALUES ('cfg-1', 'claude-code', true, '{}', ${now}, ${now}),
             ('cfg-2', 'opencode', false, '{}', ${now}, ${now}),
             ('cfg-3', 'fake', false, '{}', ${now}, ${now})
    `);
    await db.execute(sql`
      INSERT INTO projects (id, name, shorthand, selected_agents, default_agent_id, created_at, updated_at)
      VALUES ('p-1', 'P', 'P', '["claude-code","opencode"]', 'claude-code', ${now}, ${now})
    `);
    await db.execute(sql`
      INSERT INTO sessions (id, title, status, agent, created_at, updated_at)
      VALUES ('s-1', 'S', 'in_progress', 'fake', ${now}, ${now})
    `);

    // Migrations already ran on the empty db, so exercise the shipped SQL directly — twice, to prove idempotency.
    await runMigration(db);
    await runMigration(db);

    const configs = await db.execute(sql`SELECT id, agent_id FROM agent_configs ORDER BY id`);
    expect(configs.rows).toEqual([
      { id: "cfg-1", agent_id: "pstdio.harness-claude-code.claude-code" },
      { id: "cfg-2", agent_id: "pstdio.harness-open-code.opencode" },
      { id: "cfg-3", agent_id: "pstdio.harness-lab.fake" },
    ]);

    const projects = await db.execute(sql`SELECT selected_agents, default_agent_id FROM projects`);
    expect(projects.rows).toEqual([
      {
        selected_agents: '["pstdio.harness-claude-code.claude-code","pstdio.harness-open-code.opencode"]',
        default_agent_id: "pstdio.harness-claude-code.claude-code",
      },
    ]);

    const sessions = await db.execute(sql`SELECT agent FROM sessions`);
    expect(sessions.rows).toEqual([{ agent: "pstdio.harness-lab.fake" }]);

    await client.close();
  });

  it("leaves already-namespaced and unknown ids untouched", async () => {
    const client = await createDb({ path: ":memory:" });
    const { db } = client;

    const now = new Date().toISOString();
    await db.execute(sql`
      INSERT INTO agent_configs (id, agent_id, is_default, config, created_at, updated_at)
      VALUES ('cfg-1', 'pstdio.harness-claude-code.claude-code', true, '{}', ${now}, ${now}),
             ('cfg-2', 'acme.acme-agent.my-agent', false, '{}', ${now}, ${now})
    `);

    await runMigration(db);

    const configs = await db.execute(sql`SELECT id, agent_id FROM agent_configs ORDER BY id`);
    expect(configs.rows).toEqual([
      { id: "cfg-1", agent_id: "pstdio.harness-claude-code.claude-code" },
      { id: "cfg-2", agent_id: "acme.acme-agent.my-agent" },
    ]);

    await client.close();
  });
});
