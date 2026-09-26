import { expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { normalizeWorkspaceIdentities } from "./workspace-identity-migration";

test("normalizes old identities deterministically while retaining locations and reporting shared paths", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE projects(id text PRIMARY KEY, name text, shorthand text, created_at text);
      CREATE TABLE workspaces(id text PRIMARY KEY, project_id text, workspace_shorthand text, is_default boolean, name text, branch text, worktree_path text, created_at text);
      INSERT INTO projects VALUES ('a','Prompt Studio','PS','1'),('b','Prompt Studio','PS','2'),('c','Project','PS2','3');
      INSERT INTO workspaces VALUES
        ('a0','a','default',true,'repo','main',null,'0'),
        ('a1','a','WS-1',false,'WS-1','workspace/WS-1','/shared','1'),
        ('a2','a','PS-12_A1',false,'Review','workspace/PS-12_A1','/attempt','2'),
        ('b1','b','WS-1',false,'WS-1','workspace/WS-1','/shared','1');
    `);
    const evidence = await normalizeWorkspaceIdentities(db);
    expect(
      (await db.query<{ shorthand: string }>("SELECT shorthand FROM projects ORDER BY id")).rows.map(
        (p) => p.shorthand,
      ),
    ).toEqual(["PS", "PS3", "PS2"]);
    expect(
      (await db.query("SELECT workspace_shorthand, name, branch, worktree_path FROM workspaces WHERE id = 'a1'")).rows,
    ).toEqual([{ workspace_shorthand: "PS_WS-1", name: "WS-1", branch: "workspace/WS-1", worktree_path: "/shared" }]);
    expect(evidence.workspaces).toHaveLength(4);
    expect(evidence.sharedPaths).toEqual([{ path: "/shared", workspaceIds: ["a1", "b1"] }]);
    expect((await normalizeWorkspaceIdentities(db)).workspaces).toEqual([]);
  } finally {
    await db.close();
  }
});
