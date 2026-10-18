import { expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { migrateWorkspaceCapabilities } from "./workspace-capabilities-migration";

test("workspace capability upgrades preserve explicit deletion policy", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE workspaces (id text, provider_capabilities_json jsonb NOT NULL)");
    for (const [id, capabilities] of Object.entries({
      legacy: { archive: true, files: "read" },
      restricted: { archive: true, delete: false, files: "write" },
      allowed: { archive: false, delete: true, diff: true },
    }))
      await db.query("INSERT INTO workspaces VALUES ($1, $2)", [id, capabilities]);
    await migrateWorkspaceCapabilities(db);
    await migrateWorkspaceCapabilities(db);
    const result = await db.query<{ id: string; provider_capabilities_json: unknown }>(
      "SELECT * FROM workspaces ORDER BY id",
    );
    expect(result.rows).toEqual([
      { id: "allowed", provider_capabilities_json: { delete: true, diff: true } },
      { id: "legacy", provider_capabilities_json: { delete: true, files: "read" } },
      { id: "restricted", provider_capabilities_json: { delete: false, files: "write" } },
    ]);
  } finally {
    await db.close();
  }
});
