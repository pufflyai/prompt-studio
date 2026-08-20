import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionDiagnostic } from "../types/runtime";
import { loadExtensionPackage } from "./loader";

const tempDirs: string[] = [];
let previousPackagePath: string | undefined;
let previousPstdioHome: string | undefined;

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-loader-"));
  tempDirs.push(dir);
  return dir;
};

const writePackage = (dir: string) => {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "loader-test",
        version: "1.0.0",
        publisher: "pstdio",
        main: "./extension.ts",
        engines: { pstdio: EXTENSION_API_VERSION },
      },
      null,
      2,
    ),
  );
};

const writeSdkDependency = (dir: string) => {
  const sdkDir = join(dir, "node_modules", "@pstdio", "sdk");
  mkdirSync(sdkDir, { recursive: true });
  writeFileSync(
    join(sdkDir, "package.json"),
    JSON.stringify(
      {
        name: "@pstdio/sdk",
        version: "0.0.0-test",
        type: "module",
        exports: {
          "./extensions": "./extensions.ts",
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(sdkDir, "extensions.ts"),
    `
      export const markerFromSdk = "extension-owned-sdk";
      export const packageAsset = (path, baseUrl) => ({ kind: "package-asset", path, baseUrl });
    `,
  );
};

afterEach(() => {
  if (previousPackagePath === undefined) delete process.env.PSTDIO_LOADER_TEST_PACKAGE_PATH;
  else process.env.PSTDIO_LOADER_TEST_PACKAGE_PATH = previousPackagePath;
  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;

  previousPackagePath = undefined;
  previousPstdioHome = undefined;
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

const isolateRuntimeCache = () => {
  const home = join(createTempDir(), "pstdio-home");
  previousPstdioHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = home;
  return join(home, "cache", "extension-runtime");
};

const listCachedRuntimePackages = (cacheRoot: string) => {
  if (!existsSync(cacheRoot)) return [];

  return readdirSync(cacheRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name === "package")
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
};

test("loads a fresh entry without writing runtime files into the source package", async () => {
  isolateRuntimeCache();
  const dir = createTempDir();
  mkdirSync(join(dir, "src"));
  writePackage(dir);
  writeSdkDependency(dir);
  writeFileSync(join(dir, "template.md"), "Template");
  writeFileSync(join(dir, "src", "marker.ts"), `export const marker = "from-relative-module";`);
  writeFileSync(
    join(dir, "extension.ts"),
    `
      import { markerFromSdk, packageAsset } from "@pstdio/sdk/extensions";
      import { readdirSync, writeFileSync } from "node:fs";
      import { join } from "node:path";
      import { marker } from "./src/marker";

      const packagePath = process.env.PSTDIO_LOADER_TEST_PACKAGE_PATH;
      if (!packagePath) throw new Error("Missing test package path");

      const runtimeEntries = readdirSync(packagePath).filter((name) => name.startsWith(".pstdio-runtime-"));
      writeFileSync(join(packagePath, "runtime-entries.json"), JSON.stringify(runtimeEntries));

      export default {
        commands: {
          check: {
            title: marker + "/" + markerFromSdk,
            run: async () => ({ marker, markerFromSdk }),
          },
        },
        templates: {
          sample: {
            title: "Sample",
            type: "sample",
            source: packageAsset("./template.md", import.meta.url),
          },
        },
      };
    `,
  );

  previousPackagePath = process.env.PSTDIO_LOADER_TEST_PACKAGE_PATH;
  process.env.PSTDIO_LOADER_TEST_PACKAGE_PATH = dir;

  const diagnostics: ExtensionDiagnostic[] = [];
  const loaded = await loadExtensionPackage({ path: dir }, diagnostics);
  const commands = loaded?.definition.commands as Record<string, { title: string }> | undefined;
  const templates = loaded?.definition.templates as
    | Record<string, { source: { baseUrl: string; path: string } }>
    | undefined;
  const templateSource = templates?.sample.source;

  expect(diagnostics).toEqual([]);
  expect(commands?.check.title).toBe("from-relative-module/extension-owned-sdk");
  expect(templateSource ? fileURLToPath(new URL(templateSource.path, templateSource.baseUrl)) : undefined).toBe(
    join(dir, "template.md"),
  );
  expect(JSON.parse(readFileSync(join(dir, "runtime-entries.json"), "utf8"))).toEqual([]);
  expect(readdirSync(dir).filter((name) => name.startsWith(".pstdio-runtime-"))).toEqual([]);
});

test("resolves dependencies from the nearest ancestor node_modules", async () => {
  isolateRuntimeCache();
  const repoDir = createTempDir();
  const dir = join(repoDir, "extensions", "loader-test");
  mkdirSync(dir, { recursive: true });
  writePackage(dir);
  writeSdkDependency(repoDir);
  writeFileSync(
    join(dir, "extension.ts"),
    `
      import { markerFromSdk } from "@pstdio/sdk/extensions";

      export default {
        commands: {
          check: {
            title: markerFromSdk,
            run: async () => ({ markerFromSdk }),
          },
        },
      };
    `,
  );

  const diagnostics: ExtensionDiagnostic[] = [];
  const loaded = await loadExtensionPackage({ path: dir }, diagnostics);
  const commands = loaded?.definition.commands as Record<string, { title: string }> | undefined;

  expect(diagnostics).toEqual([]);
  expect(commands?.check.title).toBe("extension-owned-sdk");
});

test("keeps runtime imports in a deterministic managed cache", async () => {
  const cacheRoot = isolateRuntimeCache();
  const dir = createTempDir();
  writePackage(dir);
  writeSdkDependency(dir);
  writeFileSync(
    join(dir, "extension.ts"),
    `
      import { markerFromSdk } from "@pstdio/sdk/extensions";

      export default {
        commands: {
          check: {
            title: markerFromSdk,
            run: async () => ({ markerFromSdk }),
          },
        },
      };
    `,
  );

  const firstDiagnostics: ExtensionDiagnostic[] = [];
  await loadExtensionPackage({ path: dir }, firstDiagnostics);
  const firstCachedPackages = listCachedRuntimePackages(cacheRoot);

  const secondDiagnostics: ExtensionDiagnostic[] = [];
  await loadExtensionPackage({ path: dir }, secondDiagnostics);
  const secondCachedPackages = listCachedRuntimePackages(cacheRoot);

  expect(firstDiagnostics).toEqual([]);
  expect(secondDiagnostics).toEqual([]);
  expect(firstCachedPackages).toHaveLength(1);
  expect(secondCachedPackages).toEqual(firstCachedPackages);
  expect(existsSync(join(firstCachedPackages[0]!, "extension.ts"))).toBe(true);
});

test("uses a new runtime cache package when extension source changes", async () => {
  const cacheRoot = isolateRuntimeCache();
  const dir = createTempDir();
  writePackage(dir);
  writeSdkDependency(dir);
  const writeExtension = (title: string) =>
    writeFileSync(
      join(dir, "extension.ts"),
      `
        export default {
          commands: {
            check: {
              title: ${JSON.stringify(title)},
              run: async () => ({ title: ${JSON.stringify(title)} }),
            },
          },
        };
      `,
    );

  writeExtension("first");
  const firstDiagnostics: ExtensionDiagnostic[] = [];
  await loadExtensionPackage({ path: dir }, firstDiagnostics);
  const firstCachedPackages = listCachedRuntimePackages(cacheRoot);

  writeExtension("second");
  const secondDiagnostics: ExtensionDiagnostic[] = [];
  const loaded = await loadExtensionPackage({ path: dir }, secondDiagnostics);
  const commands = loaded?.definition.commands as Record<string, { title: string }> | undefined;
  const secondCachedPackages = listCachedRuntimePackages(cacheRoot);

  expect(firstDiagnostics).toEqual([]);
  expect(secondDiagnostics).toEqual([]);
  expect(commands?.check.title).toBe("second");
  expect(firstCachedPackages).toHaveLength(1);
  expect(secondCachedPackages).toHaveLength(2);
});

test("loads fresh transitive modules when extension source changes", async () => {
  isolateRuntimeCache();
  const dir = createTempDir();
  mkdirSync(join(dir, "src"));
  writePackage(dir);
  writeSdkDependency(dir);
  writeFileSync(
    join(dir, "extension.ts"),
    `
      import { title } from "./src/contributions";

      export default {
        commands: {
          check: {
            title,
            run: async () => ({ title }),
          },
        },
      };
    `,
  );

  writeFileSync(join(dir, "src", "contributions.ts"), `export const title = "first";`);
  await loadExtensionPackage({ path: dir }, []);

  writeFileSync(join(dir, "src", "contributions.ts"), `export const title = "second";`);
  const diagnostics: ExtensionDiagnostic[] = [];
  const loaded = await loadExtensionPackage({ path: dir }, diagnostics);
  const commands = loaded?.definition.commands as Record<string, { title: string }> | undefined;

  expect(diagnostics).toEqual([]);
  expect(commands?.check.title).toBe("second");
});

test("adds dependencies to an existing runtime cache package when node_modules appears", async () => {
  const cacheRoot = isolateRuntimeCache();
  const dir = createTempDir();
  writePackage(dir);
  writeFileSync(
    join(dir, "extension.ts"),
    `
      import { markerFromSdk } from "@pstdio/sdk/extensions";

      export default {
        commands: {
          check: {
            title: markerFromSdk,
            run: async () => ({ markerFromSdk }),
          },
        },
      };
    `,
  );

  const firstDiagnostics: ExtensionDiagnostic[] = [];
  await loadExtensionPackage({ path: dir }, firstDiagnostics);
  const cachedPackages = listCachedRuntimePackages(cacheRoot);

  writeSdkDependency(dir);
  const secondDiagnostics: ExtensionDiagnostic[] = [];
  const loaded = await loadExtensionPackage({ path: dir }, secondDiagnostics);
  const commands = loaded?.definition.commands as Record<string, { title: string }> | undefined;
  const updatedCachedPackages = listCachedRuntimePackages(cacheRoot);

  expect(firstDiagnostics).toContainEqual(expect.objectContaining({ code: "extension_import_failed" }));
  expect(cachedPackages).toHaveLength(1);
  expect(secondDiagnostics).toEqual([]);
  expect(commands?.check.title).toBe("extension-owned-sdk");
  expect(updatedCachedPackages).toHaveLength(2);
  expect(updatedCachedPackages.some((cachedPackage) => existsSync(join(cachedPackage, "node_modules")))).toBe(true);
});

test("uses a new runtime cache package when node_modules contents change", async () => {
  const cacheRoot = isolateRuntimeCache();
  const dir = createTempDir();
  writePackage(dir);
  mkdirSync(join(dir, "node_modules", "@pstdio"), { recursive: true });
  writeFileSync(
    join(dir, "extension.ts"),
    `
      import { markerFromSdk } from "@pstdio/sdk/extensions";

      export default {
        commands: {
          check: {
            title: markerFromSdk,
            run: async () => ({ markerFromSdk }),
          },
        },
      };
    `,
  );

  const firstDiagnostics: ExtensionDiagnostic[] = [];
  await loadExtensionPackage({ path: dir }, firstDiagnostics);
  const firstCachedPackages = listCachedRuntimePackages(cacheRoot);

  writeSdkDependency(dir);
  const secondDiagnostics: ExtensionDiagnostic[] = [];
  const loaded = await loadExtensionPackage({ path: dir }, secondDiagnostics);
  const commands = loaded?.definition.commands as Record<string, { title: string }> | undefined;
  const secondCachedPackages = listCachedRuntimePackages(cacheRoot);

  expect(firstDiagnostics).toContainEqual(expect.objectContaining({ code: "extension_import_failed" }));
  expect(firstCachedPackages).toHaveLength(1);
  expect(secondDiagnostics).toEqual([]);
  expect(commands?.check.title).toBe("extension-owned-sdk");
  expect(secondCachedPackages).toHaveLength(2);
});

test("prunes stale runtime cache packages once for a managed cache root", async () => {
  const cacheRoot = isolateRuntimeCache();
  const existingPackage = join(cacheRoot, "existing-extension", "old-source", "package");
  mkdirSync(existingPackage, { recursive: true });
  writeFileSync(join(existingPackage, "extension.ts"), "export default {};");

  const dir = createTempDir();
  writePackage(dir);
  writeSdkDependency(dir);
  writeFileSync(
    join(dir, "extension.ts"),
    `
      import { markerFromSdk } from "@pstdio/sdk/extensions";

      export default {
        commands: {
          check: {
            title: markerFromSdk,
            run: async () => ({ markerFromSdk }),
          },
        },
      };
    `,
  );

  const diagnostics: ExtensionDiagnostic[] = [];
  await loadExtensionPackage({ path: dir }, diagnostics);

  expect(diagnostics).toEqual([]);
  expect(existsSync(existingPackage)).toBe(false);
  expect(listCachedRuntimePackages(cacheRoot)).toHaveLength(1);
});
