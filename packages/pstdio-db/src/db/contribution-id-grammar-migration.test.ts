import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { createDb } from "./connection.pglite";
import { renamedCommandIds, renamedScheduleIds, renamedSkillKeys } from "./contribution-id-renames";

// The shipped 0029 migration rewrites durable values that store contribution ids
// renamed by the PS-321 grammar pass. migrate() applies it on connect (against an
// empty database), so this exercises the data rewrites directly against seeded rows.
const dataStatements = fs
  .readFileSync(path.join(import.meta.dir, "../../drizzle/0029_contribution_id_grammar.sql"), "utf8")
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter((statement) => statement.startsWith("UPDATE"));

const runDataRewrites = async (db: Awaited<ReturnType<typeof createDb>>["db"]) => {
  for (const statement of dataStatements) {
    await db.execute(sql.raw(statement));
  }
};

describe("0029_contribution_id_grammar", () => {
  it("covers every entry of the rename map", () => {
    const joined = dataStatements.join("\n");
    for (const [oldId, newId] of Object.entries(renamedCommandIds)) {
      expect(joined).toContain(oldId);
      expect(joined).toContain(newId);
    }
    for (const [oldId, newId] of Object.entries(renamedScheduleIds)) {
      expect(joined).toContain(`'${oldId}'`);
      expect(joined).toContain(`'${newId}'`);
    }
    for (const [oldKey, newKey] of Object.entries(renamedSkillKeys)) {
      expect(joined).toContain(`'${oldKey}'`);
      expect(joined).toContain(`'${newKey}'`);
    }
  });

  it("rewrites stored command scopes, runs, automation and skill preferences", async () => {
    const client = await createDb({ path: ":memory:" });
    const { db } = client;
    const now = new Date().toISOString();

    await db.execute(sql`
      INSERT INTO projects (id, name, shorthand, created_at, updated_at)
      VALUES ('p-1', 'P', 'P', ${now}, ${now})
    `);
    await db.execute(sql`
      INSERT INTO automation_principals (id, project_id, name, created_by, created_at)
      VALUES ('pr-1', 'p-1', 'CI', 'tester', ${now})
    `);
    await db.execute(sql`
      INSERT INTO automation_tokens (id, principal_id, token_prefix, token_digest, project_id, command_scopes_json, expires_at, created_at)
      VALUES ('t-1', 'pr-1', 'pfx', 'digest', 'p-1',
        '["pstdio.pstdio-planner.command.ticketStatus.update", "pstdio.pstdio-planner.command.set-ticket-attribute"]'::jsonb,
        ${now}, ${now})
    `);
    await db.execute(sql`
      INSERT INTO automation_runs (id, project_id, principal_id, command_id, idempotency_key, input_hash, input_json, status, created_at)
      VALUES ('r-1', 'p-1', 'pr-1', 'pstdio.pstdio-planner.command.runReview', 'k-1', 'h-1', '{}'::jsonb, 'succeeded', ${now}),
             ('r-2', 'p-1', 'pr-1', 'pstdio.pstdio-planner.command.set-ticket-attribute', 'k-2', 'h-2', '{}'::jsonb, 'succeeded', ${now})
    `);
    await db.execute(sql`
      INSERT INTO installed_extension_sources (id, install_name, extension_id, display_name, source_kind, source_path, created_at, updated_at)
      VALUES ('src-1', 'pstdio-planner-loops', 'pstdio.pstdio-planner-loops', 'Loops', 'local_path', '/tmp/loops', ${now}, ${now})
    `);
    await db.execute(sql`
      INSERT INTO extension_instances (id, installed_extension_id, scope_type, scope_id, created_at, updated_at)
      VALUES ('inst-1', 'src-1', 'project', 'p-1', ${now}, ${now})
    `);
    await db.execute(sql`
      INSERT INTO extension_automation_preferences (project_id, extension_instance_id, automation_id, enabled, created_at, updated_at)
      VALUES ('p-1', 'inst-1', 'pstdio.pstdio-planner-loops.schedule.refineTickets', false, ${now}, ${now})
    `);
    await db.execute(sql`
      INSERT INTO extension_skill_preferences (project_id, extension_instance_id, skill_key, enabled, created_at, updated_at)
      VALUES ('p-1', 'inst-1', 'implement_ticket', false, ${now}, ${now}),
             ('p-1', 'inst-1', 'pstdio', true, ${now}, ${now})
    `);

    // Run twice: rewrites match exact old values, so re-running is a no-op.
    await runDataRewrites(db);
    await runDataRewrites(db);

    const tokens = await db.execute(sql`SELECT command_scopes_json FROM automation_tokens`);
    expect(tokens.rows).toEqual([
      {
        command_scopes_json: [
          "pstdio.pstdio-planner.command.ticket-status.update",
          "pstdio.pstdio-planner.command.set-ticket-attribute",
        ],
      },
    ]);

    const runs = await db.execute(sql`SELECT id, command_id FROM automation_runs ORDER BY id`);
    expect(runs.rows).toEqual([
      { id: "r-1", command_id: "pstdio.pstdio-planner.command.run-review" },
      { id: "r-2", command_id: "pstdio.pstdio-planner.command.set-ticket-attribute" },
    ]);

    const automations = await db.execute(sql`SELECT automation_id, enabled FROM extension_automation_preferences`);
    expect(automations.rows).toEqual([
      { automation_id: "pstdio.pstdio-planner-loops.schedule.refine-tickets", enabled: false },
    ]);

    const skills = await db.execute(sql`SELECT skill_key, enabled FROM extension_skill_preferences ORDER BY skill_key`);
    expect(skills.rows).toEqual([
      { skill_key: "implement-ticket", enabled: false },
      { skill_key: "pstdio", enabled: true },
    ]);

    await client.close();
  });
});
