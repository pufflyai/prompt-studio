import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { EXTENSION_API_VERSION, type HarnessContext } from "pstdio-api-contracts/extension-kernel";
import {
  acceptPreparedRevision,
  prepareBackendHandler,
  prepareExtensionRevision,
  stopExtensionPreparation,
} from "pstdio-extensions";
import { installDefaultExtensions, installMissingDefaultExtensions } from "./default-extensions";
import { exportPreparedReleaseBundle, importPreparedReleaseBundle } from "./prepared-release-bundle";
import { createExtensionSourceCache } from "./project-extension-runtime-sources";

const previousHome = process.env.PSTDIO_HOME;
const previousPath = process.env.PATH;
const roots: string[] = [];
const fixtureContext = {} as HarnessContext;

afterEach(async () => {
  await stopExtensionPreparation();
  if (previousHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousHome;
  if (previousPath === undefined) delete process.env.PATH;
  else process.env.PATH = previousPath;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const installFixture = (path: string) => {
  const result = Bun.spawnSync([process.execPath, "install", "--ignore-scripts"], { cwd: path });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
};

const packagedHarness = async (keepInstalledCli: boolean) => {
  const root = mkdtempSync(join(tmpdir(), "prebuilt-harness-"));
  roots.push(root);
  process.env.PSTDIO_HOME = join(root, "home");
  const systemPath =
    process.platform === "win32" ? [join(process.env.SystemRoot ?? "C:\\Windows", "System32")] : ["/usr/bin", "/bin"];
  process.env.PATH = [dirname(process.execPath), ...systemPath].join(delimiter);
  expect(Bun.which("codex", { PATH: process.env.PATH })).toBeNull();

  const dependency = join(root, "private-cli");
  mkdirSync(dependency);
  writeFileSync(
    join(dependency, "package.json"),
    JSON.stringify({ name: "private-cli", version: "1.0.0", main: "index.js" }),
  );
  writeFileSync(join(dependency, "index.js"), 'export const version = "private CLI";');

  const tarball = join(root, "private-cli-1.0.0.tgz");
  const packed = Bun.spawnSync([process.execPath, "pm", "pack", "--ignore-scripts", "--destination", root], {
    cwd: dependency,
  });
  if (packed.exitCode !== 0) throw new Error(packed.stderr.toString());

  const source = join(root, "home", "extensions", "harness-codex");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      publisher: "pstdio",
      name: "harness-codex",
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      dependencies: { "private-cli": `file:${tarball.replaceAll("\\", "/")}` },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `import { createRequire } from "node:module";
     export default {
       harnesses: [{
         id: "codex",
         ref: { kind: "harness", id: "codex" },
         label: "Codex",
         capabilities: () => [],
         detect: () => ({
           available: true,
           version: Bun.which("codex", { PATH: process.env.PATH })
             ? "PATH CLI"
             : createRequire(import.meta.url)("private-cli").version,
         }),
       }],
     };`,
  );
  installFixture(source);
  const sourceSha256 = "a".repeat(64);
  const bundle = await exportPreparedReleaseBundle(await prepareExtensionRevision(source), sourceSha256);
  const path = join(root, "runtime.tgz");
  await Bun.write(path, bundle.bytes);
  const installed = join(source, "node_modules");
  if (!keepInstalledCli) rmSync(installed, { recursive: true });
  const revision = await importPreparedReleaseBundle(
    { path, descriptor: bundle.descriptor, sourceSha256 },
    source,
    "s",
  );
  await acceptPreparedRevision(source, revision);
  return { source, revision, installed, tarball };
};

test.each([
  true,
  false,
])("prebuilt harness provisions its private CLI on first use (existing dependency tree: %s)", async (keepInstalledCli) => {
  const { source, revision, installed, tarball } = await packagedHarness(keepInstalledCli);
  if (keepInstalledCli) {
    // A second dependency installation would fail with its original input gone.
    rmSync(tarball);
  }
  const loaded = await createExtensionSourceCache({}).load({ source_path: source, source_kind: "git" });
  expect(loaded?.diagnostics).toEqual([]);
  const harness = loaded!.source.definition.harnesses![0]!;
  const cachedDependencies = join(revision.packagePath, "node_modules");
  expect(await harness.capabilities(fixtureContext)).toEqual([]);
  expect(existsSync(cachedDependencies)).toBe(false);

  const result = { available: true, version: "private CLI" };
  await Promise.all([prepareBackendHandler(harness.detect), prepareBackendHandler(harness.detect)]);
  expect(existsSync(cachedDependencies)).toBe(true);
  expect(existsSync(installed)).toBe(keepInstalledCli);
  expect(await harness.detect!(fixtureContext)).toEqual(result);
});

test("a prebuilt harness uses an existing PATH CLI without provisioning a private one", async () => {
  const { source, revision, installed, tarball } = await packagedHarness(false);
  rmSync(tarball);
  const bin = dirname(source);
  const executable = process.platform === "win32" ? "codex.exe" : "codex";
  writeFileSync(join(bin, executable), "", { mode: 0o755 });
  process.env.PATH = [bin, process.env.PATH].join(delimiter);

  const loaded = await createExtensionSourceCache({}).load({ source_path: source, source_kind: "git" });
  expect(loaded?.diagnostics).toEqual([]);
  const harness = loaded!.source.definition.harnesses![0]!;
  await prepareBackendHandler(harness.detect);
  expect(await harness.detect!(fixtureContext)).toEqual({ available: true, version: "PATH CLI" });
  expect(existsSync(join(revision.packagePath, "node_modules"))).toBe(false);
  expect(existsSync(installed)).toBe(false);
});

test("default extension setup reuses an accepted harness without installing its source dependencies", async () => {
  const { installed } = await packagedHarness(false);
  const deps = {
    config: { defaultExtensions: ["harness-codex"] },
    installExtensionSource: async () => {
      throw new Error("Already accepted");
    },
  };
  expect(await installDefaultExtensions(deps)).toEqual([]);
  expect(await installMissingDefaultExtensions(deps)).toEqual([]);
  expect(existsSync(installed)).toBe(false);
});
