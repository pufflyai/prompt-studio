import { expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { preferences } from "../../db/schemas.pg";
import { createExtensionAutomationPreferencesDBService } from "../extension-preferences/automation-preferences";
import { createExtensionSkillPreferencesDBService } from "../extension-preferences/extension-preferences";
import { createExtensionSettingsDBService } from "../extension-settings/extension-settings";
import { createInstalledExtensionSourcesDBService } from "../installed-extension-sources/installed-extension-sources";
import { createProjectsDBService } from "../projects/projects";
import { createExtensionInstancesDBService } from "./extension-instances";

test("project extension configuration has a composite key and cascades with its project", async () => {
  const store = await createDb({ path: ":memory:" });
  try {
    const projects = createProjectsDBService(store.db);
    const first = await projects.create({ name: "First" });
    const second = await projects.create({ name: "Second" });
    const source = await createInstalledExtensionSourcesDBService(store.db).register({
      install_name: "shared",
      extension_id: "example.shared",
      display_name: "Shared",
      source_kind: "local_path",
      source_path: "/shared",
    });
    const instances = createExtensionInstancesDBService(store.db);
    const configuration = { enabled: false, config_json: { selected: "keep" }, display_name_override: "Saved name" };
    const a = await instances.create({
      installed_extension_id: source.id,
      scope_type: "project",
      scope_id: first.id,
      ...configuration,
    });
    const b = await instances.create({ installed_extension_id: source.id, scope_type: "project", scope_id: second.id });
    expect(
      (await store.pglite.query("SELECT project_id, extension_ref FROM project_extensions ORDER BY project_id")).rows,
    ).toHaveLength(2);
    expect(await instances.get(a.id)).toMatchObject(configuration);
    expect(Object.keys(a).sort()).toEqual(
      [
        "id",
        "installed_extension_id",
        "scope_type",
        "scope_id",
        "display_name_override",
        "enabled",
        "config_json",
        "diagnostics_json",
        "created_at",
        "updated_at",
      ].sort(),
    );
    const deleted = await projects.hardDelete(first.id);
    expect(deleted?.extensionInstances.map((row) => row.id)).toEqual([a.id]);
    expect(await instances.get(a.id)).toBeNull();
    expect(await instances.get(b.id)).not.toBeNull();
    expect((await store.pglite.query("SELECT * FROM project_extensions")).rows).toHaveLength(1);
  } finally {
    await store.close();
  }
});

for (const action of ["switch", "delete"])
  for (const kind of ["setting", "skill", "automation"])
    test(`${kind} choices cannot outlive an installation during ${action}`, async () => {
      const store = await createDb({ path: ":memory:" });
      try {
        const projects = createProjectsDBService(store.db);
        const project = await projects.create({ name: "Concurrent choices" });
        const sources = createInstalledExtensionSourcesDBService(store.db);
        const before = await sources.register({
          install_name: "before",
          extension_id: "example.tool",
          display_name: "Before",
          source_kind: "local_path",
          source_path: "/before",
        });
        const after = await sources.register({
          install_name: "after",
          extension_id: "example.tool",
          display_name: "After",
          source_kind: "local_path",
          source_path: "/after",
        });
        const instances = createExtensionInstancesDBService(store.db);
        const original = await instances.create({
          installed_extension_id: before.id,
          scope_type: "project",
          scope_id: project.id,
        });
        const setting = createExtensionSettingsDBService(store.db);
        const skill = createExtensionSkillPreferencesDBService(store.db);
        const automation = createExtensionAutomationPreferencesDBService(store.db);
        const choice = () => {
          if (kind === "setting")
            return setting.setValue({
              owner_type: "extension_instance",
              owner_id: original.id,
              extension_id: "example.tool",
              key: "choice",
              value_json: false,
            });
          if (kind === "skill")
            return skill.set({
              project_id: project.id,
              extension_instance_id: original.id,
              skill_key: "choice",
              enabled: false,
            });
          return automation.set({
            project_id: project.id,
            extension_instance_id: original.id,
            automation_id: "choice",
            enabled: false,
          });
        };
        const [write, change] = await Promise.allSettled([
          choice(),
          action === "switch"
            ? instances.activateProjectSources([
                {
                  projectId: project.id,
                  extensionId: "example.tool",
                  instanceId: original.id,
                  installedSourceId: after.id,
                },
              ])
            : projects.hardDelete(project.id),
        ]);
        expect(change.status).toBe("fulfilled");
        if (write.status === "rejected") expect(String(write.reason)).toContain("Extension instance not found");
        const rows = await store.db.select().from(preferences);
        expect(rows.filter((row) => row.scope_id === original.id)).toEqual([]);
        if (action === "delete") expect(rows.filter((row) => row.project_id === project.id)).toEqual([]);
        else if (write.status === "fulfilled") {
          const current = (await instances.list({ scope_id: project.id }))[0]!;
          if (kind === "setting")
            expect(
              (
                await setting.getValue({
                  owner_type: "extension_instance",
                  owner_id: current.id,
                  extension_id: "example.tool",
                  key: "choice",
                })
              )?.value_json,
            ).toBe(false);
          if (kind === "skill") expect((await skill.get(project.id, current.id, "choice"))?.enabled).toBe(false);
          if (kind === "automation")
            expect((await automation.get(project.id, current.id, "choice"))?.enabled).toBe(false);
        }
      } finally {
        await store.close();
      }
    });
