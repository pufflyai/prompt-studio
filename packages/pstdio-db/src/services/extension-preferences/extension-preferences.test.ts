import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createExtensionInstancesDBService } from "../extension-instances/extension-instances";
import { createInstalledExtensionSourcesDBService } from "../installed-extension-sources/installed-extension-sources";
import {
  createExtensionSkillPreferencesDBService,
  createExtensionTemplatePreferencesDBService,
} from "./extension-preferences";

let close: (() => Promise<void>) | undefined;
let templatePrefs: ReturnType<typeof createExtensionTemplatePreferencesDBService>;
let skillPrefs: ReturnType<typeof createExtensionSkillPreferencesDBService>;
let projectId: string;
let instanceId: string;

const nowTimestamp = () => new Date().toISOString();

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  templatePrefs = createExtensionTemplatePreferencesDBService(result.db);
  skillPrefs = createExtensionSkillPreferencesDBService(result.db);

  const sources = createInstalledExtensionSourcesDBService(result.db);
  const instances = createExtensionInstancesDBService(result.db);

  const timestamp = nowTimestamp();
  projectId = crypto.randomUUID();
  await result.db
    .insert(projects)
    .values({ id: projectId, name: "Test", shorthand: "T", created_at: timestamp, updated_at: timestamp });

  const installed = await sources.register({
    install_name: "ext.example",
    extension_id: "ext.example",
    display_name: "Example",
    source_kind: "local_path",
    source_path: "/builtin/example",
  });
  const instance = await instances.create({
    installed_extension_id: installed.id,
    scope_type: "project",
    scope_id: projectId,
    namespace: "example",
  });
  instanceId = instance.id;
});

afterEach(async () => {
  await close?.();
});

describe("extensionTemplatePreferencesService", () => {
  test("set, get, list, and remove a template preference", async () => {
    await templatePrefs.set({
      project_id: projectId,
      extension_instance_id: instanceId,
      template_key: "ticket",
      enabled: false,
      display_name_override: "Custom Ticket",
    });

    const fetched = await templatePrefs.get(projectId, instanceId, "ticket");
    expect(fetched?.enabled).toBe(false);
    expect(fetched?.display_name_override).toBe("Custom Ticket");

    await templatePrefs.set({
      project_id: projectId,
      extension_instance_id: instanceId,
      template_key: "ticket",
      enabled: true,
    });
    const updated = await templatePrefs.get(projectId, instanceId, "ticket");
    expect(updated?.enabled).toBe(true);

    expect(await templatePrefs.list(projectId)).toHaveLength(1);
    expect(await templatePrefs.remove(projectId, instanceId, "ticket")).toBe(true);
    expect(await templatePrefs.list(projectId)).toHaveLength(0);
  });
});

describe("extensionSkillPreferencesService", () => {
  test("set, get, and remove a skill preference", async () => {
    await skillPrefs.set({
      project_id: projectId,
      extension_instance_id: instanceId,
      skill_key: "create-pstdio-extension",
      enabled: false,
      description_override: "Custom description",
    });

    const fetched = await skillPrefs.get(projectId, instanceId, "create-pstdio-extension");
    expect(fetched?.enabled).toBe(false);
    expect(fetched?.description_override).toBe("Custom description");

    expect(await skillPrefs.remove(projectId, instanceId, "create-pstdio-extension")).toBe(true);
    expect(await skillPrefs.get(projectId, instanceId, "create-pstdio-extension")).toBeNull();
  });
});
