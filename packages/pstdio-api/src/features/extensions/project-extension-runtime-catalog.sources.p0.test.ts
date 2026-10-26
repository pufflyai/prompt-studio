import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
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
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  const body = options.broken
    ? `throw new Error("broken source");`
    : `export default {
  commands: [{
    id: ${JSON.stringify(commandName)},
    ref: { kind: "command", id: ${JSON.stringify(commandName)} },
    title: ${JSON.stringify(commandName)},
    run: async () => undefined,
  }],
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
    workspaceService: {
      getDefault: async () => (input.repos?.[0] ? { root_path: input.repos[0].path } : null),
    } as never,
    loadSources: async (options) => {
      input.countImport?.(options?.extensionPackages?.[0]?.path ?? "");
      return loadExtensionSources(options);
    },
  });

test("installing an unrelated dependency preserves a running extension's state", async () => {
  const root = createTempDir();
  const path = join(root, "counter");
  writeRuntimeExtension(path, "count");
  mkdirSync(join(root, "node_modules"));
  writeFileSync(
    join(path, "extension.ts"),
    `
    let count = 0;
    export default { commands: [{id:"count", ref:{kind:"command",id:"count"}, title:"Count", run:async()=>++count}] };
  `,
  );
  const catalog = createCatalog({ sources: () => [sourceRow({ id: "counter", extensionId: "pstdio.hello", path })] });
  const first = await catalog.get("p1");
  expect(await first.runtime.commands[0]!.run!({} as never, {} as never)).toBe(1);
  const unrelated = join(root, "node_modules", "unrelated");
  mkdirSync(unrelated);
  writeFileSync(join(unrelated, "package.json"), JSON.stringify({ name: "unrelated", version: "1.0.0" }));
  writeFileSync(join(unrelated, "index.js"), "export default 1;");
  catalog.invalidate({ sourcePath: path, reason: "source_changed" });
  const second = await catalog.get("p1");
  expect(await second.runtime.commands[0]!.run!({} as never, {} as never)).toBe(2);
});

test("updating a transitive dependency refreshes the extension runtime", async () => {
  const root = createTempDir();
  const path = join(root, "extension");
  writeRuntimeExtension(path, "read");
  const library = join(root, "node_modules", "library");
  mkdirSync(library, { recursive: true });
  writeFileSync(
    join(library, "package.json"),
    JSON.stringify({
      name: "library",
      version: "1.0.0",
      main: "index.js",
      dependencies: { leaf: "*" },
    }),
  );
  writeFileSync(join(library, "index.js"), 'export { marker } from "leaf";');
  writeFileSync(
    join(path, "extension.ts"),
    `
    import { marker } from "library";
    export default { commands: [{ id:"read", ref:{kind:"command",id:"read"}, title:marker, run:async()=>marker }] };
  `,
  );
  const catalog = createCatalog({ sources: () => [sourceRow({ id: "read", extensionId: "pstdio.hello", path })] });
  const leaf = join(library, "node_modules", "leaf");
  mkdirSync(leaf, { recursive: true });
  writeFileSync(join(leaf, "package.json"), JSON.stringify({ name: "leaf", version: "1.0.0", main: "index.js" }));
  writeFileSync(join(leaf, "index.js"), 'export const marker = "original";');
  expect(await (await catalog.get("p1")).runtime.commands[0]!.run!({} as never, {} as never)).toBe("original");
  writeFileSync(join(leaf, "package.json"), JSON.stringify({ name: "leaf", version: "2.0.0", main: "index.js" }));
  writeFileSync(join(leaf, "index.js"), 'export const marker = "updated";');
  catalog.invalidate({ sourcePath: path, reason: "source_changed" });
  const repaired = await catalog.get("p1");
  expect(repaired.runtime.diagnostics).toEqual([]);
  expect(await repaired.runtime.commands[0]!.run!({} as never, {} as never)).toBe("updated");
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

    expect(first.runtime.commands.map((command) => command.id)).toEqual(["pstdio.hello.command.count"]);
    expect(second).toBe(first);
    expect(imports).toBe(1);
  });

  test("an edited source is imported once more on the next read", async () => {
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
    writeRuntimeExtension(path, "recount");
    catalog.invalidate({ sourcePath: path, reason: "source_changed" });
    const second = await catalog.get("p1");
    const third = await catalog.get("p1");

    expect(second.generation).toBe(2);
    expect(second.runtime.commands.map((command) => command.id)).toEqual(["pstdio.hello.command.recount"]);
    expect(third).toBe(second);
    expect(imports).toBe(2);
  });

  test("an invalidated but unchanged source keeps its module import", async () => {
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
    catalog.invalidate({ sourcePath: path, reason: "source_changed" });
    catalog.invalidate({ reason: "runtime_refresh" });
    const second = await catalog.get("p1");

    expect(second.generation).toBe(2);
    expect(second.runtime.commands[0]?.run).toBe(first.runtime.commands[0]?.run);
    expect(imports).toBe(1);
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
    expect(snapshot.runtime.commands.map((command) => command.id)).toEqual(["pstdio.hello.command.local"]);
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

    expect(snapshot.runtime.commands.map((command) => command.id)).toEqual(["pstdio.hello.command.healthy"]);
    expect(snapshot.runtime.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "extension_manifest_not_found",
    );
  });

  // Replacing an install renames the directory away for an instant. Dropping it from the
  // snapshot tells every consumer the extension is gone, and the views it owns are torn
  // down instead of refreshed.
  test("keeps the last healthy contributions while a source is being replaced", async () => {
    const root = createTempDir();
    const path = join(root, "reloading");
    writeRuntimeExtension(path, "healthy");

    const catalog = createCatalog({
      sources: () => [sourceRow({ id: "reloading-source", extensionId: "pstdio.hello", path })],
    });

    expect((await catalog.get("p1")).runtime.commands.map((command) => command.id)).toEqual([
      "pstdio.hello.command.healthy",
    ]);

    rmSync(join(path, "package.json"));
    catalog.invalidate({ sourcePath: path, reason: "source_changed" });

    expect((await catalog.get("p1")).runtime.commands.map((command) => command.id)).toEqual([
      "pstdio.hello.command.healthy",
    ]);
  });

  // A source whose last refresh failed still has exactly one version on disk. Serving the
  // commands it used to declare made the runtime and the repository disagree.
  test("serves the commands a source declares now, not the ones a failed refresh recorded", async () => {
    const root = createTempDir();
    const path = join(root, "renamed-command");
    writeRuntimeExtension(path, "getConfig");
    let status = "loaded";

    const catalog = createCatalog({
      sources: () => [sourceRow({ id: "renamed-source", extensionId: "pstdio.hello", path, status })],
    });

    expect((await catalog.get("p1")).runtime.commands.map((command) => command.id)).toEqual([
      "pstdio.hello.command.getConfig",
    ]);

    writeRuntimeExtension(path, "config.get");
    status = "error";
    catalog.invalidate({ sourcePath: path, reason: "source_changed" });

    expect((await catalog.get("p1")).runtime.commands.map((command) => command.id)).toEqual([
      "pstdio.hello.command.config.get",
    ]);
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
    expect(snapshot.runtime.commands.map((command) => command.id)).toEqual(["pstdio.hello.command.healthy"]);
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
    const runtime = await catalog.getSourcesRuntime([{ source_path: path, source_kind: "local_path" }]);

    expect(runtime.commands.map((command) => command.id)).toEqual(["pstdio.hello.command.count"]);
    expect(imports).toBe(1);
  });
});

test("a storage folder conflict does not stop the project's extensions from loading", async () => {
  const path = join(createTempDir(), "hello");
  writeRuntimeExtension(path, "greet");
  const repo = createTempDir();
  mkdirSync(join(repo, ".pstdio/extension-storage/hello"), { recursive: true });
  mkdirSync(join(repo, ".pstdio/extension-storage/pstdio.hello"), { recursive: true });
  const catalog = createCatalog({
    sources: () => [sourceRow({ id: "hello", extensionId: "pstdio.hello", path })],
    repos: [{ id: "repo", path: repo }],
  });

  const snapshot = await catalog.get("p1");

  expect(snapshot.runtime.commands.map((command) => command.id)).toEqual(["pstdio.hello.command.greet"]);
});
