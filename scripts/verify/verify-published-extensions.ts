import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { releasedApiBaselines, selectApiBaselines } from "./extension-api-baselines";
import { freshInstallArgs } from "./fresh-install";

interface ExtensionManifest {
  name: string;
  engines?: { pstdio?: string };
  dependencies?: Record<string, string>;
}

export async function publishedExtensionDirs(root: string) {
  const manifest = await Bun.file(join(root, "package.json")).json();
  const releaseConfig = await Bun.file(join(root, ".changeset/config.json")).json();
  const ignored = new Set<string>(releaseConfig.ignore ?? []);
  const dirs = new Set<string>();
  for (const workspace of manifest.workspaces as string[]) {
    for await (const path of new Bun.Glob(`${workspace}/package.json`).scan({ cwd: root })) {
      const pkg: ExtensionManifest = await Bun.file(join(root, path)).json();
      const sdk = pkg.dependencies?.["@pstdio/sdk"];
      if (!ignored.has(pkg.name) && pkg.engines?.pstdio && sdk && !sdk.startsWith("workspace:"))
        dirs.add(dirname(path));
    }
  }
  return [...dirs].sort();
}

const excluded = new Set(["node_modules", "dist", ".git", "bun.lock", "bun.lockb", "coverage", "test-results"]);

export async function stageExtension(root: string, dir: string, temporaryRoot: string) {
  const destination = join(temporaryRoot, dir);
  await cp(join(root, dir), destination, { recursive: true, filter: (path) => !excluded.has(basename(path)) });
  // Keep shared compiler settings and the hermetic test preload, but no workspace manifest or packages.
  for (const file of ["tsconfig.base.json", "scripts/test-setup.ts"]) {
    if (!(await Bun.file(join(root, file)).exists())) continue;
    await mkdir(dirname(join(temporaryRoot, file)), { recursive: true });
    await cp(join(root, file), join(temporaryRoot, file));
  }
  return destination;
}

async function run(dir: string, command: string[]) {
  const child = Bun.spawn(command, { cwd: dir, stdout: "inherit", stderr: "inherit" });
  if ((await child.exited) !== 0) throw new Error(`${command.join(" ")} failed`);
}

export async function verifyPublishedExtension(root: string, dir: string) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "pstdio-published-extension-"));
  const started = performance.now();
  try {
    const destination = await stageExtension(root, dir, temporaryRoot);
    console.log(`\nChecking ${dir} against published dependencies`);
    await run(destination, ["bun", ...freshInstallArgs(root, destination)]);
    const dependencies = (await Bun.file(join(destination, "package.json")).json()).dependencies;
    for (const name of ["@pstdio/sdk", "@pstdio/ui"]) {
      if (!dependencies?.[name]) continue;
      const resolved = await Bun.file(join(destination, "node_modules", name, "package.json")).json();
      console.log(`${dir}: ${name} ${dependencies[name]} -> ${resolved.version}`);
    }
    await run(destination, ["bun", "run", "--no-install", "tsc", "--noEmit"]);
    await run(destination, ["bun", "test", "--pass-with-no-tests"]);
    const packagePath = join(destination, "package.json");
    const manifest = await Bun.file(packagePath).json();
    const baselines = selectApiBaselines(manifest.engines.pstdio, releasedApiBaselines(root));
    for (const baseline of baselines) {
      console.log(`${dir}: checking API ${baseline.api} with SDK ${baseline.sdk}`);
      const pinned = { ...manifest, dependencies: { ...manifest.dependencies, "@pstdio/sdk": baseline.sdk } };
      if (pinned.devDependencies?.["@pstdio/sdk"]) {
        pinned.devDependencies = { ...pinned.devDependencies, "@pstdio/sdk": baseline.sdk };
      }
      await Bun.write(packagePath, JSON.stringify(pinned));
      await run(destination, ["bun", ...freshInstallArgs(root, destination)]);
      try {
        await run(destination, ["bun", "run", "--no-install", "tsc", "--noEmit"]);
      } catch (error) {
        throw new Error(
          `${dir} uses APIs unavailable in ${baseline.api}. Raise engines.pstdio to the first API it needs.`,
          { cause: error },
        );
      }
    }
    console.log(`Passed ${dir} (${((performance.now() - started) / 1000).toFixed(1)}s)`);
  } catch (error) {
    throw new Error(`${dir}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "../..");
  let failed = false;
  for (const dir of await publishedExtensionDirs(root)) {
    try {
      await verifyPublishedExtension(root, dir);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      failed = true;
    }
  }
  process.exitCode = failed ? 1 : 0;
}
