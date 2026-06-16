import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionStorageDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  projects,
} from "pstdio-db";
import { pruneProjectExtensionInstances } from "./extension-prune";

let close: (() => Promise<void>) | undefined;
let deps: Parameters<typeof pruneProjectExtensionInstances>[0];
let storage: ReturnType<typeof createExtensionStorageDBService>;
let instances: ReturnType<typeof createExtensionInstancesDBService>;
let projectId: string;
let instanceId: string;

const now = () => new Date().toISOString();
const EXTENSIONS_ROOT = "/ext-root";
const MISSING_SOURCE_PATH = `${EXTENSIONS_ROOT}/planner`;

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;

  instances = createExtensionInstancesDBService(result.db);
  storage = createExtensionStorageDBService(result.db);
  const sources = createInstalledExtensionSourcesDBService(result.db);
  deps = {
    extensionInstancesService: instances,
    installedExtensionSourcesService: sources,
    extensionUserDataService: createExtensionUserDataDBService(result.db),
    notifyInstalledSourcesChanged: async () => {},
  };

  const timestamp = now();
  projectId = crypto.randomUUID();
  await result.db
    .insert(projects)
    .values({ id: projectId, name: "P", shorthand: "P", created_at: timestamp, updated_at: timestamp });

  const installed = await sources.register({
    install_name: "planner",
    extension_id: "pstdio.planner",
    display_name: "Planner",
    source_kind: "local_path",
    source_path: MISSING_SOURCE_PATH,
  });
  const instance = await instances.create({
    installed_extension_id: installed.id,
    scope_type: "project",
    scope_id: projectId,
  });
  instanceId = instance.id;
});

afterEach(async () => {
  await close?.();
});

describe("pruneProjectExtensionInstances", () => {
  // Regression: a temporarily-missing source (a failed upgrade) must not destroy the user's tickets.
  test("keeps an instance whose source vanished when it still owns user data", async () => {
    await storage.setCollectionItem({
      extension_instance_id: instanceId,
      scope_type: "project",
      scope_id: projectId,
      collection: "tickets",
      item_id: "T-1",
      value_json: { title: "Keep me" },
      project_id: projectId,
    });

    const removed = await pruneProjectExtensionInstances(deps, {
      activeSourcePaths: [],
      projectId,
      sourcePathPrefix: EXTENSIONS_ROOT,
    });

    expect(removed).toHaveLength(0);
    expect(await instances.get(instanceId)).not.toBeNull();
    const tickets = await storage.listCollection({
      extension_instance_id: instanceId,
      scope_type: "project",
      scope_id: projectId,
      collection: "tickets",
    });
    expect(tickets).toHaveLength(1);
  });

  test("still prunes an instance whose source vanished when it owns no user data", async () => {
    const removed = await pruneProjectExtensionInstances(deps, {
      activeSourcePaths: [],
      projectId,
      sourcePathPrefix: EXTENSIONS_ROOT,
    });

    expect(removed).toHaveLength(1);
    expect(await instances.get(instanceId)).toBeNull();
  });
});
