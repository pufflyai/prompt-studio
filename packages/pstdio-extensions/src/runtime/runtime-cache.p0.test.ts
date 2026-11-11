import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionDiagnostic } from "../types/runtime";
import { loadExtensionPackage } from "./loader";
import { publishRuntimePackage } from "./runtime-cache";

const tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-runtime-cache-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

const writeExtension = (dir: string) => {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "runtime-cache-test",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(dir, "extension.ts"), `export default { commands: { check: { title: "Check" } } };`);
};

const loaderPath = join(import.meta.dir, "loader.ts");

// Each process is a separate host start; the loader keeps per-process cache state.
const loadInNewProcess = (home: string, extensionDir: string) => {
  const script = join(createTempDir(), "load.ts");
  writeFileSync(
    script,
    `
      import { loadExtensionPackage } from ${JSON.stringify(loaderPath)};
      const diagnostics = [];
      await loadExtensionPackage({ path: process.argv[2] }, diagnostics);
      if (diagnostics.length > 0) throw new Error(JSON.stringify(diagnostics));
    `,
  );
  const result = Bun.spawnSync([process.execPath, script, extensionDir], {
    env: { ...process.env, PSTDIO_HOME: home },
  });
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
};

const findBundles = (cacheRoot: string) =>
  readdirSync(cacheRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".pstdio-runtime-bundle.mjs"))
    .map((entry) => join(entry.parentPath, entry.name));

test("a restarted host reuses unchanged runtime bundles and removes caches other hosts stopped using", () => {
  const home = join(createTempDir(), "home");
  const cacheRoot = join(home, "cache", "extension-runtime");
  mkdirSync(join(cacheRoot, "replaced-host", "runtime-cache-test", "old", "package"), { recursive: true });
  mkdirSync(join(cacheRoot, "active-host", "runtime-cache-test", "old", "package"), { recursive: true });
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  utimesSync(join(cacheRoot, "replaced-host"), eightDaysAgo, eightDaysAgo);
  const extensionDir = createTempDir();
  writeExtension(extensionDir);

  loadInNewProcess(home, extensionDir);
  const [bundle] = findBundles(cacheRoot);
  const built = statSync(bundle!);

  loadInNewProcess(home, extensionDir);
  const reused = statSync(bundle!);

  expect(findBundles(cacheRoot)).toEqual([bundle!]);
  expect(reused.ino).toBe(built.ino);
  expect(reused.mtimeMs).toBe(built.mtimeMs);
  expect(existsSync(join(cacheRoot, "replaced-host"))).toBe(false);
  expect(existsSync(join(cacheRoot, "active-host"))).toBe(true);
});

test("an interrupted runtime package copy is never published", () => {
  const runtimePackagePath = join(createTempDir(), "key", "package");
  mkdirSync(join(runtimePackagePath, ".."));

  expect(() =>
    publishRuntimePackage(runtimePackagePath, (stagingPath) => {
      mkdirSync(stagingPath);
      writeFileSync(join(stagingPath, "extension.ts"), "partial");
      throw new Error("copy interrupted");
    }),
  ).toThrow("copy interrupted");
  expect(readdirSync(join(runtimePackagePath, ".."))).toEqual([]);

  publishRuntimePackage(runtimePackagePath, (stagingPath) => {
    mkdirSync(stagingPath);
    writeFileSync(join(stagingPath, "extension.ts"), "complete");
  });
  expect(readdirSync(runtimePackagePath)).toEqual(["extension.ts"]);
});

test("loading a newer version never removes a version that is still loading", async () => {
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(createTempDir(), "home");
  try {
    const extensionDir = createTempDir();
    writeExtension(extensionDir);
    for (let round = 0; round < 5; round += 1) {
      const diagnostics: ExtensionDiagnostic[] = [];
      writeFileSync(
        join(extensionDir, "extension.ts"),
        `export default { commands: { check: { title: "a${round}" } } };`,
      );
      const first = loadExtensionPackage({ path: extensionDir }, diagnostics);
      writeFileSync(
        join(extensionDir, "extension.ts"),
        `export default { commands: { check: { title: "b${round}" } } };`,
      );
      const second = loadExtensionPackage({ path: extensionDir }, diagnostics);
      await Promise.all([first, second]);
      expect(diagnostics).toEqual([]);
    }
  } finally {
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
  }
});
