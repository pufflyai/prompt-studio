import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { files, projects } from "../../db/schemas.pg";
import { createExtensionInstancesDBService } from "../extension-instances/extension-instances";
import { createInstalledExtensionSourcesDBService } from "../installed-extension-sources/installed-extension-sources";
import { createTemplatesDBService } from "../templates/templates";
import { createProjectTemplateDefaultsDBService } from "./project-template-defaults";

let close: (() => Promise<void>) | undefined;
let svc: ReturnType<typeof createProjectTemplateDefaultsDBService>;
let templatesSvc: ReturnType<typeof createTemplatesDBService>;
let projectId: string;
let fileId: string;
let extensionInstanceId: string;

const nowTimestamp = () => new Date().toISOString();

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  svc = createProjectTemplateDefaultsDBService(result.db);
  templatesSvc = createTemplatesDBService(result.db);
  const sources = createInstalledExtensionSourcesDBService(result.db);
  const instances = createExtensionInstancesDBService(result.db);

  const timestamp = nowTimestamp();
  projectId = crypto.randomUUID();
  fileId = crypto.randomUUID();
  await result.db
    .insert(projects)
    .values({ id: projectId, name: "Test", shorthand: "T", created_at: timestamp, updated_at: timestamp });
  await result.db.insert(files).values({
    id: fileId,
    project_id: projectId,
    file_name: "tpl.md",
    file_kind: "template",
    storage_path: "/tmp/tpl",
    size_bytes: 0,
    created_at: timestamp,
    updated_at: timestamp,
  });

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
  extensionInstanceId = instance.id;
});

afterEach(async () => {
  await close?.();
});

describe("projectTemplateDefaultsService", () => {
  test("set and update a project template default", async () => {
    const tpl = await templatesSvc.create({
      project_id: projectId,
      name: "ticket",
      template_type: "ticket",
      file_id: fileId,
    });

    await svc.set({
      project_id: projectId,
      template_type: "ticket",
      source: "project_template",
      template_id: tpl.id,
    });

    const fetched = await svc.get(projectId, "ticket");
    expect(fetched?.source).toBe("project_template");
    expect(fetched?.template_id).toBe(tpl.id);
  });

  test("set switches between project and extension defaults", async () => {
    const tpl = await templatesSvc.create({
      project_id: projectId,
      name: "ticket",
      template_type: "ticket",
      file_id: fileId,
    });

    await svc.set({
      project_id: projectId,
      template_type: "ticket",
      source: "project_template",
      template_id: tpl.id,
    });

    await svc.set({
      project_id: projectId,
      template_type: "ticket",
      source: "extension_template",
      extension_instance_id: extensionInstanceId,
      template_key: "ticket",
    });

    const fetched = await svc.get(projectId, "ticket");
    expect(fetched?.source).toBe("extension_template");
    expect(fetched?.template_id).toBeNull();
    expect(fetched?.extension_instance_id).toBe(extensionInstanceId);
    expect(fetched?.template_key).toBe("ticket");
  });

  test("remove deletes the default", async () => {
    const tpl = await templatesSvc.create({
      project_id: projectId,
      name: "ticket",
      template_type: "ticket",
      file_id: fileId,
    });

    await svc.set({
      project_id: projectId,
      template_type: "ticket",
      source: "project_template",
      template_id: tpl.id,
    });
    expect(await svc.remove(projectId, "ticket")).toBe(true);
    expect(await svc.get(projectId, "ticket")).toBeNull();
  });
});
