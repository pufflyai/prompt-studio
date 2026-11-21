import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createExtensionConnectionsDBService } from "../services/extension-connections/extension-connections";
import { createProjectsDBService } from "../services/projects/projects";
import { createDb } from "./connection.pglite";
import { prepareConnectionCredentialsUpgrade } from "./connection-credentials-upgrade";
import { restoreReleasedPreferenceTables } from "./preference-upgrade.fixture";
import { prepareProjectExtensionsUpgrade } from "./project-extensions-upgrade";
import { preferences } from "./schemas/preferences";

for (const interrupted of [false, true])
  test(`released connection credentials retain project boundaries through ${interrupted ? "interrupted" : "normal"} upgrade`, async () => {
    const root = await mkdtemp(join(tmpdir(), "connection-credential-upgrade-"));
    const path = join(root, "database");
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      store = await createDb({ path });
      for (const id of ["first", "second"]) await createProjectsDBService(store.db).create({ id, name: id });
      await restoreReleasedPreferenceTables(store);
      const stamp = "2026-11-20T12:00:00.000Z";
      const check = { ok: true, status: 200, error: null, checkedAt: stamp };
      for (const id of ["first", "second"])
        await store.pglite.query(
          `INSERT INTO extension_connections
      VALUES ($1, $2, 'example.connection', 'service', 'https://api.example.test/v1', 'bearer', null, $3, $4::jsonb, $5::jsonb, $6, $6)`,
          [`connection-${id}`, id, `private-ref-${id}`, JSON.stringify({ region: "EU" }), JSON.stringify(check), stamp],
        );
      if (interrupted) {
        await prepareConnectionCredentialsUpgrade(store.db, path);
        await prepareProjectExtensionsUpgrade(store.db, store.path);
        await migrate(store.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle") });
      }
      await store.close();
      store = await createDb({ path });
      const connections = createExtensionConnectionsDBService(store.db);
      for (const projectId of ["first", "second"])
        expect(
          await connections.get({ projectId, extensionId: "example.connection", contributionId: "service" }),
        ).toMatchObject({
          id: `connection-${projectId}`,
          project_id: projectId,
          credential_project_id: projectId,
          secret_ref: `private-ref-${projectId}`,
          config_json: { region: "EU" },
          last_check_json: check,
          created_at: stamp,
          updated_at: stamp,
        });
      const configs = JSON.stringify(await store.db.select().from(preferences));
      expect(configs).not.toContain("private-ref-");
      expect(configs).not.toContain("secret_ref");
      await connections.remove({ projectId: "first", extensionId: "example.connection", contributionId: "service" });
      expect(await connections.credentials.isReferenced("private-ref-first")).toBe(false);
      expect(await connections.credentials.isReferenced("private-ref-second")).toBe(true);
      await store.close();
      store = await createDb({ path });
      expect(
        (
          await createExtensionConnectionsDBService(store.db).get({
            projectId: "second",
            extensionId: "example.connection",
            contributionId: "service",
          })
        )?.secret_ref,
      ).toBe("private-ref-second");
    } finally {
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
