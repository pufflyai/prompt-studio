import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionInstancesDBService } from "../services/extension-instances/extension-instances";
import { createExtensionSettingsDBService } from "../services/extension-settings/extension-settings";
import { createInstalledExtensionSourcesDBService } from "../services/installed-extension-sources/installed-extension-sources";
import { createProjectsDBService } from "../services/projects/projects";
import { createDb } from "./connection.pglite";
import { seedLegacyProjectExtension } from "./preference-upgrade.fixture";

test("startup retires duplicate installations, preserving the selected source and saved choices", async () => {
  const root = await mkdtemp(join(tmpdir(), "project-extension-duplicates-"));
  const path = join(root, "pstdio.db");
  let store: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    store = await createDb({ path });
    const project = await createProjectsDBService(store.db).create({ name: "Project" });
    const sources = createInstalledExtensionSourcesDBService(store.db);
    const source = (name: string) =>
      sources.register({
        install_name: name,
        extension_id: "example.tool",
        display_name: "Tool",
        source_kind: "local_path",
        source_path: join(root, name),
      });
    const current = await source("current");
    const previous = await source("previous");
    await mkdir(previous.source_path);
    const checkoutFile = join(previous.source_path, "local.txt");
    await writeFile(checkoutFile, "local edits");
    const instances = createExtensionInstancesDBService(store.db);
    const input = { scope_id: project.id, scope_type: "project" };
    const retained = await instances.create({
      ...input,
      installed_extension_id: current.id,
      config_json: { selected: "current" },
    });
    expect(await instances.attach({ ...input, installed_extension_id: previous.id, enabled: false })).toBeNull();

    const retired = await seedLegacyProjectExtension(store, {
      project_id: project.id,
      extension_ref: previous.id,
      enabled: false,
      config_json: { selected: "previous", extra: true },
    });
    const settings = createExtensionSettingsDBService(store.db);
    const choice = { owner_type: "extension_instance" as const, extension_id: "example.tool", key: "pin" };
    await settings.setValue({ ...choice, owner_id: retired.id, value_json: true });
    await settings.setValue({ ...choice, key: "retained", owner_id: retired.id, value_json: "old" });
    await settings.setValue({ ...choice, key: "retained", owner_id: retained.id, value_json: "current" });
    await store.close();

    store = await createDb({ path });
    const repaired = await createExtensionInstancesDBService(store.db).list({ scope_id: project.id });
    expect(repaired.map(({ id, enabled, config_json }) => ({ id, enabled, config_json }))).toEqual([
      { id: retained.id, enabled: true, config_json: { selected: "current", extra: true } },
    ]);
    const saved = await createExtensionSettingsDBService(store.db).getValue({ ...choice, owner_id: retained.id });
    expect(saved?.value_json).toBe(true);
    const preserved = await createExtensionSettingsDBService(store.db).getValue({
      ...choice,
      key: "retained",
      owner_id: retained.id,
    });
    expect(preserved?.value_json).toBe("current");
    expect(await Bun.file(checkoutFile).text()).toBe("local edits");
    const archiveDir = `${path}-migration-exports`;
    const files = await readdir(archiveDir);
    const archived = await Bun.file(
      join(archiveDir, files.find((file) => file.startsWith("duplicate-project-extensions-"))!),
    ).json();
    expect(archived).toMatchObject({
      installation: { extension_ref: previous.id, config_json: { selected: "previous" } },
    });
  } finally {
    await store?.close();
    await rm(root, { recursive: true, force: true });
  }
});
