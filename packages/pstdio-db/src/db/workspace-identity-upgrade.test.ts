import { expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createExtensionResourceSequencesDBService } from "../services/extension-resource-sequences";
import { createDb } from "./connection.pglite";

test("upgrades legacy identities without changing stored relationships or execution locations", async () => {
  const root = mkdtempSync(join(tmpdir(), "workspace-identity-upgrade-"));
  let active: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    const migrations = join(root, "old");
    const source = resolve(import.meta.dirname, "../../drizzle");
    mkdirSync(join(migrations, "meta"), { recursive: true });
    const journal = JSON.parse(readFileSync(join(source, "meta/_journal.json"), "utf8"));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 31);
    writeFileSync(join(migrations, "meta/_journal.json"), JSON.stringify(journal));
    for (const entry of journal.entries)
      copyFileSync(join(source, `${entry.tag}.sql`), join(migrations, `${entry.tag}.sql`));
    const dbPath = join(root, "db");
    const old = new PGlite(dbPath);
    await migrate(drizzle(old), { migrationsFolder: migrations });
    await old.exec(`
      INSERT INTO projects(id,name,shorthand,created_at,updated_at) VALUES ('a','Prompt Studio','PS','1','1'),('b','Prompt Studio','PS','2','2');
      INSERT INTO workspaces(id,project_id,name,workspace_shorthand,is_default,branch,worktree_path,created_at,updated_at,archived,deleted_at,provider_ref_json)
      VALUES ('a0','a','root','default',true,'main',null,'0','0',false,null,null),
        ('a1','a','attempt','PS-8_A1',false,'workspace/PS-8_A1','/retained/one','1','1',true,'3','{"version":1,"data":{"key":"retained"}}'),
        ('b1','b','old','WS-1',false,'workspace/WS-1','/retained/two','1','1',false,null,null);
      INSERT INTO extension_resource_sequences VALUES ('b','planner','ticket','PS',8,'1','1');
      INSERT INTO sessions(id,project_id,title,agent,status,created_at,updated_at) VALUES ('session','a','Work','test','completed','1','1');
      INSERT INTO workspace_sessions(id,workspace_id,session_id,created_at) VALUES ('link','a1','session','1');
    `);
    const before = (
      await old.query(
        "SELECT id,project_id,branch,worktree_path,archived,deleted_at,provider_ref_json FROM workspaces ORDER BY id",
      )
    ).rows;
    await old.close();
    active = await createDb({ path: dbPath });
    expect(
      (
        await active.pglite.query(
          "SELECT id,project_id,branch,worktree_path,archived,deleted_at,provider_ref_json FROM workspaces ORDER BY id",
        )
      ).rows,
    ).toEqual(before);
    expect((await active.pglite.query("SELECT workspace_shorthand FROM workspaces ORDER BY id")).rows).toEqual([
      { workspace_shorthand: "PS_WS-0" },
      { workspace_shorthand: "PS_WS-1" },
      { workspace_shorthand: "PS2_WS-1" },
    ]);
    expect((await active.pglite.query("SELECT workspace_id,session_id FROM workspace_sessions")).rows).toEqual([
      { workspace_id: "a1", session_id: "session" },
    ]);
    expect(
      (
        await createExtensionResourceSequencesDBService(active.db).allocate({
          projectId: "b",
          extensionId: "planner",
          kind: "ticket",
          prefix: "PS2",
        })
      ).shorthand,
    ).toBe("PS-9");
    const evidence = readFileSync(join(dbPath, "workspace-identity-migration.json"), "utf8");
    expect(JSON.parse(evidence).workspaces).toHaveLength(3);
    await active.close();
    active = await createDb({ path: dbPath });
    expect(readFileSync(join(dbPath, "workspace-identity-migration.json"), "utf8")).toBe(evidence);
    await expect(active.pglite.query("UPDATE projects SET shorthand='PS' WHERE id='b'")).rejects.toThrow();
    await expect(
      active.pglite.query("UPDATE workspaces SET workspace_shorthand='PS_WS-0' WHERE id='b1'"),
    ).rejects.toThrow();
  } finally {
    await active?.close();
    rmSync(root, { recursive: true, force: true });
  }
});
