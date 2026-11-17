import { afterEach, expect, test } from "bun:test";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionDiagnostic } from "../types/runtime";
import { loadExtensionPackage } from "./loader";
import { stopExtensionPreparation } from "./preparation-client";
import { maintainPreparedCache } from "./prepared-cache";
import { type PreparedExtensionRevision, preparedCacheRoot } from "./prepared-revision";
import { publishRuntimePackage } from "./runtime-cache";

const tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-runtime-cache-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await stopExtensionPreparation();
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
  writeFileSync(join(dir, "value.txt"), "cached runtime");
  writeFileSync(
    join(dir, "extension.ts"),
    `import { readFileSync } from "node:fs";
     export default { commands: [{ id: "check", ref: { kind: "command", id: "check" }, title: "Check", run: async () => readFileSync(new URL("./value.txt", import.meta.url), "utf8") }] };`,
  );
};

const loaderPath = join(import.meta.dir, "loader.ts");

// Each process is a separate host start; the loader keeps per-process cache state.
const loadInNewProcess = (home: string, extensionDir: string, executable = process.execPath) => {
  const script = join(createTempDir(), "load.ts");
  writeFileSync(
    script,
    `
      import { loadExtensionPackage } from ${JSON.stringify(loaderPath)};
      import { stopExtensionPreparation } from ${JSON.stringify(join(import.meta.dir, "preparation-client.ts"))};
      const diagnostics = [];
      try {
        const loaded = await loadExtensionPackage({ path: process.argv[2] }, diagnostics);
        if (diagnostics.length > 0) throw new Error(JSON.stringify(diagnostics));
        console.log(JSON.stringify(loaded?.preparedRevision));
      } finally {
        await stopExtensionPreparation();
      }
    `,
  );
  const result = Bun.spawnSync([executable, script, extensionDir], {
    env: { ...process.env, PSTDIO_HOME: home },
  });
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  return JSON.parse(result.stdout.toString()) as PreparedExtensionRevision;
};

const findBundles = (cacheRoot: string) =>
  readdirSync(cacheRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".pstdio-runtime-bundle.mjs"))
    .map((entry) => join(entry.parentPath, entry.name));

test("a restarted host reuses unchanged runtime bundles and removes caches other hosts stopped using", async () => {
  const home = join(createTempDir(), "home");
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = home;
  try {
    const cacheRoot = join(preparedCacheRoot(), "revisions");
    const extensionDir = createTempDir();
    writeExtension(extensionDir);
    const first = loadInNewProcess(home, extensionDir);
    const [bundle] = findBundles(cacheRoot);
    expect(bundle).toBe(first.entryPath);
    const built = statSync(bundle!);

    const restarted = loadInNewProcess(home, extensionDir);
    const reused = statSync(bundle!);
    expect(restarted.id).toBe(first.id);
    expect(restarted.entryPath).toBe(first.entryPath);
    expect(findBundles(cacheRoot)).toEqual([bundle!]);
    expect(reused.ino).toBe(built.ino);
    expect(reused.mtimeMs).toBe(built.mtimeMs);

    const retiredExecutable = join(createTempDir(), process.platform === "win32" ? "bun.exe" : "bun");
    copyFileSync(process.execPath, retiredExecutable);
    const retired = loadInNewProcess(home, extensionDir, retiredExecutable);
    expect(retired.host).not.toBe(first.host);
    expect(retired.id).not.toBe(first.id);
    const diagnostics: ExtensionDiagnostic[] = [];
    const active = await loadExtensionPackage({ path: extensionDir }, diagnostics);
    expect(diagnostics).toEqual([]);
    expect(active?.preparedRevision?.id).toBe(first.id);

    // Both real artifacts are old; only the active host's process lease protects its files.
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const retiredRoot = join(cacheRoot, retired.id);
    const activeRoot = join(cacheRoot, first.id);
    utimesSync(retiredRoot, eightDaysAgo, eightDaysAgo);
    utimesSync(activeRoot, eightDaysAgo, eightDaysAgo);
    expect(existsSync(retired.entryPath)).toBe(true);
    maintainPreparedCache();
    expect(existsSync(retiredRoot)).toBe(false);
    expect(existsSync(activeRoot)).toBe(true);
    expect(existsSync(active!.preparedRevision!.entryPath)).toBe(true);
    expect(await active!.definition.commands![0].run({} as never, {})).toBe("cached runtime");
    expect(findBundles(cacheRoot)).toEqual([bundle!]);
  } finally {
    await stopExtensionPreparation();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
  }
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
