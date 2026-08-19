import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExtensionSources } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "./deps";
import { loadProjectExtensionRuntime } from "./extension-command-runtime";
import { createProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";

const tempDirs: string[] = [];
let previousPstdioHome: string | undefined;

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-runtime-catalog-"));
  tempDirs.push(dir);
  return dir;
};

const writeCountingExtension = () => {
  const dir = createTempDir();
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "import-counter",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(join(dir, "extension.ts"), "export default {};\n");
  return dir;
};

const createDeps = (sourcePath: string) => {
  let importCount = 0;
  const projectService = {
    get: async (id: string) => ({ id, name: "Test", shorthand: "TST" }),
  };
  const extensionService = {
    listEnabledSourcesForProject: async () => [
      { installedSource: { source_path: sourcePath, source_kind: "local_path", status: "loaded" } },
    ],
  };
  const repoService = { listByProject: async () => [] };
  const extensionRuntimeCatalog = createProjectExtensionRuntimeCatalog({
    extensionService: extensionService as never,
    loadSources: async (options) => {
      importCount += 1;
      return loadExtensionSources(options);
    },
    repoService: repoService as never,
  });

  const deps = {
    projectService,
    extensionService,
    repoService,
    extensionRuntimeCatalog,
  } as unknown as ExtensionsRouteDeps;

  return { deps, extensionRuntimeCatalog, getImportCount: () => importCount };
};

beforeEach(() => {
  previousPstdioHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(createTempDir(), "pstdio-home");
});

afterEach(() => {
  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;
  previousPstdioHome = undefined;
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

test("repeated project runtime loads reuse one module import", async () => {
  const sourcePath = writeCountingExtension();
  const { deps, getImportCount } = createDeps(sourcePath);

  const first = await loadProjectExtensionRuntime(deps, "p1");
  const second = await loadProjectExtensionRuntime(deps, "p1");

  expect(first.enabledSources).toHaveLength(1);
  expect(second.project.id).toBe("p1");
  expect(getImportCount()).toBe(1);
});

test("a catalog refresh causes exactly one fresh import on the next load", async () => {
  const sourcePath = writeCountingExtension();
  const { deps, extensionRuntimeCatalog, getImportCount } = createDeps(sourcePath);

  await loadProjectExtensionRuntime(deps, "p1");
  await loadProjectExtensionRuntime(deps, "p1");
  extensionRuntimeCatalog.refresh();
  await loadProjectExtensionRuntime(deps, "p1");
  await loadProjectExtensionRuntime(deps, "p1");

  expect(getImportCount()).toBe(2);
});
