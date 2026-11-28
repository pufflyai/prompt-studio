import { expect, test } from "bun:test";
import {
  createDb,
  createExtensionAutomationPreferencesDBService,
  createExtensionFilesDBService,
  createExtensionInstancesDBService,
  createExtensionSettingsDBService,
  createExtensionSkillPreferencesDBService,
  createExtensionUserDataDBService,
  createFilesDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { EventBus } from "../features/sync/event-bus";
import { getFullState } from "../features/sync/get-full-state";
import { createExtensionService } from "./extension-service";
import { createProjectService } from "./project-service";
import { createSyncService } from "./sync-service";

test("provider activation replaces the old sync identity and retains stable owned files", async () => {
  const store = await createDb({ path: ":memory:" });
  try {
    const projects = createProjectsDBService(store.db);
    const project = await projects.create({ name: "Activation" });
    const sources = createInstalledExtensionSourcesDBService(store.db);
    const instances = createExtensionInstancesDBService(store.db);
    const before = await sources.register({
      install_name: "previous",
      extension_id: "example.tool",
      display_name: "Previous",
      source_kind: "registry",
      source_path: "/previous",
    });
    const after = await sources.register({
      install_name: "replacement",
      extension_id: "example.tool",
      display_name: "Replacement",
      source_kind: "registry",
      source_path: "/replacement",
    });
    const original = await instances.create({
      installed_extension_id: before.id,
      scope_type: "project",
      scope_id: project.id,
      config_json: { saved: true },
    });
    const stamp = new Date().toISOString();
    await createFilesDBService(store.db).insert({
      id: "saved-file",
      project_id: project.id,
      file_name: "Saved.md",
      file_kind: "extension",
      storage_path: "/unavailable/saved-file",
      mime_type: "text/markdown",
      size_bytes: 0,
      hash: null,
      created_at: stamp,
      updated_at: stamp,
    });
    const files = createExtensionFilesDBService(store.db);
    await files.attach({
      project_id: project.id,
      extension_instance_id: original.id,
      file_id: "saved-file",
      scope_type: "resource",
      scope_id: "saved",
    });
    const skill = createExtensionSkillPreferencesDBService(store.db);
    const automation = createExtensionAutomationPreferencesDBService(store.db);
    const settings = createExtensionSettingsDBService(store.db);
    await skill.set({
      project_id: project.id,
      extension_instance_id: original.id,
      skill_key: "choice",
      enabled: false,
    });
    await automation.set({
      project_id: project.id,
      extension_instance_id: original.id,
      automation_id: "choice",
      enabled: false,
    });
    await settings.setValue({
      owner_type: "extension_instance",
      owner_id: original.id,
      extension_id: "example.tool",
      key: "choice",
      value_json: "saved",
    });
    const eventBus = new EventBus();
    const service = createExtensionService({
      extensionInstancesService: instances,
      installedExtensionSourcesService: sources,
      extensionUserDataService: createExtensionUserDataDBService(store.db),
      eventBus,
      recovery: { exclusive: async <T>(_id: string, task: () => Promise<T>) => task() },
      projectService: createProjectService({
        projectsDBService: projects,
        syncService: createSyncService({ db: store.db }),
        eventBus,
      }),
    });
    const [result] = await service.activatePublishedExtensions([
      {
        projectId: project.id,
        instanceId: original.id,
        enabled: true,
        beforeActivate: async () => {},
        source: { kind: "existing", id: after.id },
      },
    ]);
    expect(result!.instance.id).not.toBe(original.id);
    expect(result!.instance.config_json).toEqual({ saved: true });
    expect(await instances.get(original.id)).toBeNull();
    await expect(
      settings.setValue({
        owner_type: "extension_instance",
        owner_id: original.id,
        extension_id: "example.tool",
        key: "stale",
        value_json: "must not become orphaned",
      }),
    ).rejects.toThrow("Extension instance not found");
    expect((await skill.get(project.id, result!.instance.id, "choice"))?.enabled).toBe(false);
    expect((await automation.get(project.id, result!.instance.id, "choice"))?.enabled).toBe(false);
    expect(
      (
        await settings.getValue({
          owner_type: "extension_instance",
          owner_id: result!.instance.id,
          extension_id: "example.tool",
          key: "choice",
        })
      )?.value_json,
    ).toBe("saved");
    const events = eventBus.getSince(0).filter((event) => event.table === "extension_instances");
    expect(events.map((event) => [event.op, (event.data as { id: string }).id])).toEqual([
      ["delete", original.id],
      ["set", result!.instance.id],
    ]);
    expect((await getFullState(store.db)).extension_instances).toEqual([result!.instance]);
    expect(
      (
        await files.list({
          project_id: project.id,
          extension_instance_id: result!.instance.id,
          scope_type: "resource",
          scope_id: "saved",
        })
      ).map((file) => file.id),
    ).toEqual(["saved-file"]);
    // Older hosts could leave preferences under a since-retired installation ID.
    await store.pglite.query(
      `INSERT INTO preferences (scope,scope_id,extension_id,key,sync,value,project_id,updated_at)
       SELECT scope,$1,extension_id,key,sync,value || '{"enabled":true}'::jsonb,project_id,updated_at
       FROM preferences WHERE project_id=$2 AND scope_id=$3 AND key='skill:choice'`,
      [original.id, project.id, result!.instance.id],
    );
    const eventCount = eventBus.seq;
    await expect(
      service.activatePublishedExtensions([
        {
          projectId: project.id,
          instanceId: result!.instance.id,
          enabled: true,
          beforeActivate: async () => {},
          source: { kind: "existing", id: before.id },
        },
      ]),
    ).rejects.toThrow("Failed query");
    expect((await skill.get(project.id, original.id, "choice"))?.enabled).toBe(true);
    expect((await skill.get(project.id, result!.instance.id, "choice"))?.enabled).toBe(false);
    expect(await instances.get(result!.instance.id)).toEqual(result!.instance);
    expect(await sources.get(before.id)).not.toBeNull();
    expect(eventBus.getSince(eventCount)).toEqual([]);
  } finally {
    await store.close();
  }
});
