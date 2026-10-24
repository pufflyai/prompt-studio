import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { EventBus } from "../features/sync/event-bus";
import { createExtensionEnablement } from "./extension-enablement";
import { createExtensionService } from "./extension-service";
import { createProjectService } from "./project-service";
import { createSyncService } from "./sync-service";

let root: string;
let close: (() => Promise<void>) | undefined;
const previous = { home: process.env.PSTDIO_HOME, catalog: process.env.PSTDIO_EXTENSION_CATALOG };

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "extension-enablement-"));
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_EXTENSION_CATALOG = join(root, "catalog.json");
  const origin = {
    kind: "git",
    url: "https://github.com/pufflyai/prompt-studio",
    path: "extensions/tools",
    ref: "main",
  };
  writeFileSync(
    process.env.PSTDIO_EXTENSION_CATALOG,
    JSON.stringify({
      version: 1,
      extensions: [
        { installName: "tools", displayName: "Tools", description: "", default: false, alwaysEnabled: true, origin },
      ],
    }),
  );
});

afterEach(async () => {
  await close?.();
  if (previous.home === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previous.home;
  if (previous.catalog === undefined) delete process.env.PSTDIO_EXTENSION_CATALOG;
  else process.env.PSTDIO_EXTENSION_CATALOG = previous.catalog;
  rmSync(root, { recursive: true, force: true });
});

test("a required provider wins when it appears while an optional copy is being enabled", async () => {
  const database = await createDb({ path: ":memory:" });
  close = database.close;
  const instances = createExtensionInstancesDBService(database.db);
  const sources = createInstalledExtensionSourcesDBService(database.db);
  const projectService = createProjectService({
    syncService: createSyncService({ db: database.db }),
    eventBus: new EventBus(),
    projectsDBService: createProjectsDBService(database.db),
  });
  const extensionService = createExtensionService({
    extensionInstancesService: instances,
    installedExtensionSourcesService: sources,
    extensionUserDataService: createExtensionUserDataDBService(database.db),
    projectService,
  });
  const project = await projectService.create({ name: "Claims" });
  const register = (installName: string, sourcePath: string) =>
    extensionService.registerInstalledSource({
      displayName: "Tools",
      extensionId: "pstdio.tools",
      installName,
      manifest: {},
      name: "tools",
      sourcePath,
    });
  const createInstance = (source: { id: string }) =>
    instances.create({
      installed_extension_id: source.id,
      scope_id: project.id,
      scope_type: "project",
      enabled: false,
    });

  const optional = await createInstance(await register("tools-copy", join(root, "repo", "tools")));
  // Hold the optional claim after its policy check, so the required provider registers in between.
  const optionalChecked = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const enablement = createExtensionEnablement({
    extensionInstancesService: {
      ...instances,
      claimProjectExtensionProvider: async (input) => {
        if (input.instanceId === optional.id) {
          optionalChecked.resolve();
          await release.promise;
        }
        return instances.claimProjectExtensionProvider(input);
      },
    },
    installedExtensionSourcesService: sources,
    emitExtensionInstance: () => {},
  });

  const optionalClaim = enablement.setProjectExtensionEnabled(optional.id, true);
  await optionalChecked.promise;
  const required = await createInstance(await register("tools", join(root, "home", "extensions", "tools")));
  const requiredClaim = enablement.setProjectExtensionEnabled(required.id, true);
  await Promise.race([requiredClaim, Bun.sleep(100)]);
  release.resolve();
  await Promise.all([optionalClaim, requiredClaim]);

  expect((await instances.get(required.id))?.enabled).toBe(true);
  expect((await instances.get(optional.id))?.enabled).toBe(false);
});
