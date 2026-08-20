import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExtensionSources } from "pstdio-extensions";
import { createProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";

const tempDirs: string[] = [];
let previousPstdioHome: string | undefined;

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-runtime-catalog-sources-"));
  tempDirs.push(dir);
  return dir;
};

const writeRuntimeExtension = (root: string, commandName: string, options: { broken?: boolean } = {}) => {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "hello",
      version: "1.0.0",
      displayName: "Hello",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  const body = options.broken
    ? `throw new Error("broken source");`
    : `export default {
  commands: {
    ${JSON.stringify(commandName)}: { title: ${JSON.stringify(commandName)}, run: async () => undefined },
  },
};`;
  writeFileSync(join(root, "extension.ts"), body);
};

type SourceRows = Array<{
  instance: { id: string; namespace: string; enabled: boolean };
  installedSource: {
    id: string;
    extension_id: string;
    source_kind: "local_path" | "git";
    source_path: string;
    status: string;
  };
}>;

const sourceRow = (input: {
  id: string;
  extensionId: string;
  kind?: "local_path" | "git";
  path: string;
  status?: string;
}) => ({
  instance: { id: `${input.id}-instance`, namespace: "hello", enabled: true },
  installedSource: {
    id: input.id,
    extension_id: input.extensionId,
    source_kind: input.kind ?? ("local_path" as const),
    source_path: input.path,
    status: input.status ?? "loaded",
  },
});

const createCatalog = (input: {
  sources: () => SourceRows;
  repos?: Array<{ id: string; path: string }>;
  countImport?: (path: string) => void;
}) =>
  createProjectExtensionRuntimeCatalog({
    extensionService: { listEnabledSourcesForProject: async () => input.sources() } as never,
    projectService: { get: async (id: string) => ({ id, name: "Project One", shorthand: "PO" }) } as never,
    repoService: { listByProject: async () => input.repos ?? [] } as never,
    loadSources: async (options) => {
      input.countImport?.(options?.extensionPackages?.[0]?.path ?? "");
      return loadExtensionSources(options);
    },
  });

beforeEach(() => {
  previousPstdioHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(createTempDir(), "pstdio-home");
});

afterEach(() => {
  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;
  previousPstdioHome = undefined;
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("project extension runtime catalog with real sources", () => {
  test("repeated project reads reuse one module import per source", async () => {
    const path = join(createTempDir(), "counter");
    writeRuntimeExtension(path, "count");
    let imports = 0;
    const catalog = createCatalog({
      sources: () => [sourceRow({ id: "counter", extensionId: "pstdio.hello", path })],
      countImport: () => {
        imports += 1;
      },
    });

    const first = await catalog.get("p1");
    const second = await catalog.get("p1");

    expect(first.runtime.commands.map((command) => command.id)).toEqual(["hello.count"]);
    expect(second).toBe(first);
    expect(imports).toBe(1);
  });

  test("a source invalidation causes exactly one fresh import on the next read", async () => {
    const path = join(createTempDir(), "counter");
    writeRuntimeExtension(path, "count");
    let imports = 0;
    const catalog = createCatalog({
      sources: () => [sourceRow({ id: "counter", extensionId: "pstdio.hello", path })],
      countImport: () => {
        imports += 1;
      },
    });

    await catalog.get("p1");
    catalog.invalidate({ sourcePath: path, reason: "source_changed" });
    const second = await catalog.get("p1");
    const third = await catalog.get("p1");

    expect(second.generation).toBe(2);
    expect(third).toBe(second);
    expect(imports).toBe(2);
  });

  test("passes installed source kind and repo roots into normalization", async () => {
    const root = createTempDir();
    const globalPath = join(root, "global-hello");
    const repoPath = join(root, "repo");
    const localPath = join(repoPath, ".pstdio", "extensions", "hello");
    writeRuntimeExtension(globalPath, "global");
    writeRuntimeExtension(localPath, "local");

    const catalog = createCatalog({
      sources: () => [
        sourceRow({ id: "global-source", extensionId: "pstdio.hello", kind: "git", path: globalPath }),
        sourceRow({ id: "local-source", extensionId: "pstdio.hello", path: localPath }),
      ],
      repos: [{ id: "repo-1", path: repoPath }],
    });

    const snapshot = await catalog.get("project-1");

    expect(snapshot.project).toEqual({ id: "project-1", name: "Project One", shorthand: "PO" });
    expect(snapshot.runtime.commands.map((command) => command.id)).toEqual(["hello.local"]);
    expect(snapshot.runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "extension_overridden_by_local",
    );
  });

  test("skips enabled sources whose package manifest was removed", async () => {
    const root = createTempDir();
    const healthyPath = join(root, "healthy");
    const stalePath = join(root, "gone");
    writeRuntimeExtension(healthyPath, "healthy");
    mkdirSync(stalePath, { recursive: true });

    const catalog = createCatalog({
      sources: () => [
        sourceRow({ id: "healthy-source", extensionId: "pstdio.hello", path: healthyPath }),
        sourceRow({ id: "stale-source", extensionId: "pstdio.gone", path: stalePath }),
      ],
    });

    const snapshot = await catalog.get("p1");

    expect(snapshot.runtime.commands.map((command) => command.id)).toEqual(["hello.healthy"]);
    expect(snapshot.runtime.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "extension_manifest_not_found",
    );
  });

  // Writing to a source file leaves it briefly not "loaded". Dropping it from the
  // snapshot tells every consumer the extension is gone, and the views it owns are torn
  // down instead of refreshed.
  test("keeps the last healthy contributions of a source that is reloading", async () => {
    const root = createTempDir();
    const path = join(root, "reloading");
    writeRuntimeExtension(path, "healthy");
    let status = "loaded";

    const catalog = createCatalog({
      sources: () => [sourceRow({ id: "reloading-source", extensionId: "pstdio.hello", path, status })],
    });

    expect((await catalog.get("p1")).runtime.commands.map((command) => command.id)).toEqual(["hello.healthy"]);

    status = "loading";
    catalog.invalidate({ sourcePath: path, reason: "source_changed" });

    expect((await catalog.get("p1")).runtime.commands.map((command) => command.id)).toEqual(["hello.healthy"]);
  });

  test("a broken source publishes with empty contributions and its import diagnostic", async () => {
    const root = createTempDir();
    const healthyPath = join(root, "healthy");
    const brokenPath = join(root, "broken");
    writeRuntimeExtension(healthyPath, "healthy");
    writeRuntimeExtension(brokenPath, "never", { broken: true });

    const catalog = createCatalog({
      sources: () => [
        sourceRow({ id: "healthy-source", extensionId: "pstdio.hello", path: healthyPath }),
        sourceRow({ id: "broken-source", extensionId: "pstdio.broken", path: brokenPath }),
      ],
    });

    const snapshot = await catalog.get("p1");

    expect(snapshot.generation).toBe(1);
    expect(snapshot.stale).toBeNull();
    expect(snapshot.runtime.commands.map((command) => command.id)).toEqual(["hello.healthy"]);
    expect(snapshot.runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_import_failed");
  });

  test("installed-source inspection shares the project source cache", async () => {
    const path = join(createTempDir(), "counter");
    writeRuntimeExtension(path, "count");
    let imports = 0;
    const catalog = createCatalog({
      sources: () => [sourceRow({ id: "counter", extensionId: "pstdio.hello", path })],
      countImport: () => {
        imports += 1;
      },
    });

    await catalog.get("p1");
    const runtime = await catalog.getInstalledSourceRuntime({ source_path: path, source_kind: "local_path" } as never);

    expect(runtime.commands.map((command) => command.id)).toEqual(["hello.count"]);
    expect(imports).toBe(1);
  });
});
