import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { createExtensionService } from "../../services/extension-service";
import { createProjectService } from "../../services/project-service";
import { createSyncService } from "../../services/sync-service";
import { EventBus } from "../sync/event-bus";
import { writeExtension } from "./default-extensions-test-fixtures";
import { hashExtensionSource, loadExtensionSource } from "./extension-runtime";
import { syncInstalledExtensionsForProjects } from "./installed-extension-sync";
import { syncRepoExtensionsForProject } from "./repo-extensions";

const cleanup: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const run of cleanup.splice(0).reverse()) await run();
});

type DiscoveryReads = {
  loadExtension?: typeof loadExtensionSource;
  hashExtension?: (sourcePath: string) => Promise<string>;
};

const setup = async (scope: "user" | "repo") => {
  const database = await createDb({ path: ":memory:" });
  cleanup.push(database.close);
  const home = mkdtempSync(join(tmpdir(), "pstdio-upgrade-discovery-"));
  cleanup.push(() => rmSync(home, { recursive: true, force: true }));
  const projectService = createProjectService({
    syncService: createSyncService({ db: database.db }),
    eventBus: new EventBus(),
    projectsDBService: createProjectsDBService(database.db),
  });
  const sources = createInstalledExtensionSourcesDBService(database.db);
  const extensionService = createExtensionService({
    extensionInstancesService: createExtensionInstancesDBService(database.db),
    installedExtensionSourcesService: sources,
    extensionUserDataService: createExtensionUserDataDBService(database.db),
    recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
    projectService,
  });
  const project = await projectService.create({ name: "Upgraded tools" });
  const root = scope === "user" ? home : join(home, ".pstdio", "extensions");
  const discover = (reads: DiscoveryReads = {}) =>
    scope === "user"
      ? syncInstalledExtensionsForProjects({ extensionService, extensionsRoot: root, projectService, ...reads })
      : syncRepoExtensionsForProject({
          extensionService,
          installedExtensionSourcesService: sources,
          projectId: project.id,
          repoPath: home,
          ...reads,
        });
  return { root, sources, extensionService, discover };
};

// A watcher's discovery pauses while reading a tool. Meanwhile an upgrade replaces the
// folder and registers its release without the discovery's accepted revision changing.
const discoverAcrossUpgrade = async (scope: "user" | "repo", pause: "load" | "hash", initialApi?: string) => {
  const { root, sources, extensionService, discover } = await setup(scope);
  const sourcePath = join(root, "home");
  writeExtension(sourcePath, "home", undefined, initialApi);
  await discover();
  expect((await sources.getBySourcePath(sourcePath))?.version).toBe("1.0.0");

  const paused = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const wait = async () => {
    paused.resolve();
    await resume.promise;
  };
  const discovery = discover({
    loadExtension: async (path) => {
      const loaded = await loadExtensionSource(path, { accepted: true });
      if (pause === "load") await wait();
      return loaded;
    },
    hashExtension: async (path) => {
      if (pause === "hash") await wait();
      return hashExtensionSource(path);
    },
  });
  await paused.promise;

  const manifest = JSON.parse(await Bun.file(join(sourcePath, "package.json")).text());
  const upgraded = { ...manifest, version: "2.0.0", engines: { pstdio: `^${EXTENSION_API_VERSION}` } };
  writeFileSync(join(sourcePath, "package.json"), JSON.stringify(upgraded));
  await extensionService.registerInstalledSource({
    installName: "home",
    extensionId: "pstdio.home",
    displayName: "home",
    manifest: upgraded,
    name: "home",
    sourcePath,
    sourceHash: hashExtensionSource(sourcePath),
    version: "2.0.0",
  });

  resume.resolve();
  await discovery;
  return (await sources.getBySourcePath(sourcePath))?.version;
};

test("discovery that loaded a tool before its upgrade keeps the upgraded release", async () => {
  expect(await discoverAcrossUpgrade("user", "load")).toBe("2.0.0");
});

test("discovery that hashed an upgraded folder keeps it while the accepted revision is older", async () => {
  expect(await discoverAcrossUpgrade("user", "hash")).toBe("2.0.0");
});

test("discovery that read an incompatible tool before its upgrade keeps the upgraded release", async () => {
  expect(await discoverAcrossUpgrade("user", "load", "^0.0.9")).toBe("2.0.0");
});

test("repository discovery that loaded a tool before its upgrade keeps the upgraded release", async () => {
  expect(await discoverAcrossUpgrade("repo", "load")).toBe("2.0.0");
});
