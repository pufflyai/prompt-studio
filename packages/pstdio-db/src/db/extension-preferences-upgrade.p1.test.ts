import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createExtensionInstancesDBService } from "../services/extension-instances/extension-instances";
import { createExtensionAutomationPreferencesDBService } from "../services/extension-preferences/automation-preferences";
import { createExtensionSkillPreferencesDBService } from "../services/extension-preferences/extension-preferences";
import { createExtensionSettingsDBService } from "../services/extension-settings/extension-settings";
import { createInstalledExtensionSourcesDBService } from "../services/installed-extension-sources/installed-extension-sources";
import { createProjectsDBService } from "../services/projects/projects";
import { createWebviewPreferencesDBService } from "../services/webview-preferences/webview-preferences";
import { createDb } from "./connection.pglite";
import { prepareExtensionPreferencesUpgrade } from "./extension-preferences-upgrade";
import { restoreReleasedPreferenceTables } from "./preference-upgrade.fixture";
import { prepareProjectExtensionsUpgrade } from "./project-extensions-upgrade";

for (const interrupted of [false, true])
  test(`released scoped preferences survive ${interrupted ? "interruption after schema commit" : "upgrade and reopen"}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "extension-preferences-upgrade-"));
    const path = join(root, "database");
    let connection: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      connection = await createDb({ path });
      const project = await createProjectsDBService(connection.db).create({ name: "Released preference owner" });
      const source = await createInstalledExtensionSourcesDBService(connection.db).register({
        install_name: "migration",
        extension_id: "example.preference-migration",
        display_name: "Preference fixture",
        source_kind: "local_path",
        source_path: "/preference-fixture",
      });
      const instance = await createExtensionInstancesDBService(connection.db).create({
        installed_extension_id: source.id,
        scope_type: "project",
        scope_id: project.id,
      });
      await restoreReleasedPreferenceTables(connection);
      const legacyId = crypto.randomUUID();
      await connection.pglite.query("UPDATE extension_instances SET id=$1 WHERE id=$2", [legacyId, instance.id]);
      const stamp = "2026-11-20T12:00:00.000Z";
      for (const [ownerType, ownerId, value] of [
        ["installed_extension", source.id, "global"],
        ["extension_instance", legacyId, "project"],
        ["device_extension", source.extension_id, "device"],
      ])
        await connection.pglite.query(
          "INSERT INTO extension_settings VALUES ($1, $2, $3, 'shared', $4::jsonb, $5, $5)",
          [ownerType, ownerId, source.extension_id, JSON.stringify(value), stamp],
        );
      await connection.pglite.query(
        "INSERT INTO extension_skill_preferences VALUES ($1, $2, 'shared', false, 'Custom name', 'Custom description', $3::jsonb, $4, $4)",
        [project.id, legacyId, JSON.stringify({ nested: [true, "日本語"] }), stamp],
      );
      const oversized = "x".repeat(5 * 1024 * 1024);
      for (const [key, value] of [
        ["a-before", "first"],
        ["oversized", { content: oversized }],
        ["z-after", "last"],
      ]) {
        await connection.pglite.query(
          "INSERT INTO extension_settings VALUES ('installed_extension', $1, $2, $3, $4::jsonb, $5, $5)",
          [source.id, source.extension_id, key, JSON.stringify(value), stamp],
        );
      }
      await connection.pglite.query(
        "INSERT INTO extension_automation_preferences VALUES ($1, $2, 'shared', false, $3, $3)",
        [project.id, legacyId, stamp],
      );
      // More than one migration page, sharing an owner/key spelling with a different preference family.
      const webviews = Array.from({ length: 205 }, (_, index) => ({
        extension_id: source.extension_id,
        name: index === 0 ? "shared" : `range-${index}`,
        scope_type: "user",
        scope_id: source.extension_id,
        value_json: { index, selected: `value-${index}` },
        updated_at: stamp,
      }));
      await connection.pglite.query(
        `INSERT INTO webview_preferences SELECT * FROM jsonb_to_recordset($1::jsonb)
      AS input(extension_id text, name text, scope_type text, scope_id text, value_json jsonb, updated_at text)`,
        [JSON.stringify(webviews)],
      );
      if (interrupted) {
        await prepareExtensionPreferencesUpgrade(connection.db, path);
        await prepareProjectExtensionsUpgrade(connection.db, connection.path);
        await migrate(connection.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle") });
        // Exit after schema commit, without running the returned value-restoration callback.
      }
      await connection.close();
      connection = await createDb({ path });
      const settings = createExtensionSettingsDBService(connection.db);
      const largeKey = {
        owner_type: "installed_extension" as const,
        owner_id: source.id,
        extension_id: source.extension_id,
      };
      const retained = (await settings.getValue({ ...largeKey, key: "oversized" }))?.value_json as { content: string };
      expect(new Bun.CryptoHasher("sha256").update(retained.content).digest("hex")).toBe(
        new Bun.CryptoHasher("sha256").update(oversized).digest("hex"),
      );
      expect((await settings.getValue({ ...largeKey, key: "a-before" }))?.value_json).toBe("first");
      expect((await settings.getValue({ ...largeKey, key: "z-after" }))?.value_json).toBe("last");
      for (const [owner_type, owner_id, value] of [
        ["installed_extension" as const, source.id, "global"],
        ["extension_instance" as const, instance.id, "project"],
        ["device_extension" as const, source.extension_id, "device"],
      ] as const)
        expect(
          await settings.getValue({ owner_type, owner_id, extension_id: source.extension_id, key: "shared" }),
        ).toMatchObject({
          value_json: value,
          created_at: stamp,
          updated_at: stamp,
        });
      expect(
        await createExtensionSkillPreferencesDBService(connection.db).get(project.id, instance.id, "shared"),
      ).toMatchObject({
        enabled: false,
        display_name_override: "Custom name",
        description_override: "Custom description",
        metadata_json: { nested: [true, "日本語"] },
        created_at: stamp,
        updated_at: stamp,
      });
      expect(
        await createExtensionAutomationPreferencesDBService(connection.db).get(project.id, instance.id, "shared"),
      ).toMatchObject({ enabled: false, created_at: stamp, updated_at: stamp });
      const webview = createWebviewPreferencesDBService(connection.db);
      for (const key of webviews) expect(await webview.get(key)).toEqual(key.value_json);
      await connection.close();
      connection = await createDb({ path });
      expect(
        (
          await createExtensionSettingsDBService(connection.db).getValue({
            owner_type: "device_extension",
            owner_id: source.extension_id,
            extension_id: source.extension_id,
            key: "shared",
          })
        )?.value_json,
      ).toBe("device");
    } finally {
      await connection?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
