import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
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

test("a restarted host reuses unchanged runtime bundles and removes other hosts' caches", () => {
  const home = join(createTempDir(), "home");
  const cacheRoot = join(home, "cache", "extension-runtime");
  const otherHostPackage = join(cacheRoot, "other-host", "runtime-cache-test", "old", "package");
  mkdirSync(otherHostPackage, { recursive: true });
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
  expect(existsSync(join(cacheRoot, "other-host"))).toBe(false);
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
