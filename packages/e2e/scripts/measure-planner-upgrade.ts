import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { InstallExtensionResponse, UpgradeProjectExtensionResponse } from "pstdio-api-contracts";
import {
  type BundledExtensionSources,
  packExtensionSource,
  releaseBundleHost,
  unpackExtension,
} from "pstdio-extensions/distribution";
import { folderProjectInput } from "../src/helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "../src/packaged/packaged-serve-helpers";
import { startRegistryWireFixture } from "../src/packaged/registry-wire.fixture";

type Variant = "source" | "bundle" | "warm";
const allVariants: Variant[] = ["source", "bundle", "warm"];
const argument = (name: string) =>
  Bun.argv
    .slice(2)
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.split("=")[1];
const inBrowser = Bun.argv.includes("--browser");
const requestedVariant = argument("variant") ?? (inBrowser ? "warm" : undefined);
const variants = requestedVariant ? allVariants.filter((variant) => variant === requestedVariant) : allVariants;
if (!variants.length) throw new Error("Use --variant=source, --variant=bundle, or --variant=warm.");
const requestedInteractive = argument("interactive");
const interactive = allVariants.find((variant) => variant === requestedInteractive);
if (requestedInteractive && !interactive)
  throw new Error("Use --interactive=source, --interactive=bundle, or --interactive=warm.");
if (inBrowser && (requestedVariant !== "warm" || interactive)) {
  throw new Error("--browser measures warm upgrades and cannot be combined with --interactive.");
}
const seedConflict = Bun.argv.includes("--conflict");
if (seedConflict && !interactive) throw new Error("--conflict requires --interactive.");
const samples = Number(argument("samples") ?? "1");
if (!Number.isInteger(samples) || samples < 1 || samples > 30) throw new Error("Use --samples=1 through --samples=30.");

const archives = resolve(import.meta.dir, "../../../packages/pstdio/files/extension-sources");
const catalog = (await Bun.file(join(archives, "manifest.json")).json()) as BundledExtensionSources;
const planner = catalog.sources.find(({ id }) => id === "pstdio.planner");
const descriptor = planner?.bundles?.find(({ host }) => host === releaseBundleHost());
if (!planner || !descriptor)
  throw new Error("Build the packaged CLI and its Planner bundle with bun scripts/build/build-compile.ts.");
const { version, installName } = planner;
const sourceArchive = join(archives, `${encodeURIComponent(installName)}.tgz`);
const runtimeArchive = join(archives, "runtime", `${descriptor.sha256}.tgz`);
const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
const previousMinor = minor > 0 ? `${major}.${minor - 1}.999` : "0.0.1";
const oldVersion = patch > 0 ? `${major}.${minor}.${patch - 1}` : previousMinor;
if (Bun.semver.order(oldVersion, version) >= 0)
  throw new Error("Measurement requires a stable Planner version above 0.0.1.");

const scratch = await mkdtemp(join(tmpdir(), "pstdio-measure-planner-"));
const initialArchive = join(scratch, "initial-planner.tgz");
const waitForPrefetch = async (home: string, apiUrl: string, headers: HeadersInit) => {
  const inventory = await fetch(apiUrl, { headers });
  if (!inventory.ok) throw new Error(`Loading extension inventory returned ${inventory.status}.`);
  const deadline = Date.now() + 15_000;
  const cacheRoot = join(home, "cache", "extension-revisions", "revisions");
  const warmed = new Bun.Glob("*/warmed-release.json");
  while (true) {
    const files = [...warmed.scanSync({ cwd: cacheRoot, absolute: true })];
    if (files.length > 0) break;
    if (Date.now() >= deadline) throw new Error("The verified release did not prefetch in time.");
    await Bun.sleep(25);
  }
};

const runSample = async (variant: Variant, iteration: number, leaveOpen: boolean) => {
  const root = await mkdtemp(join(scratch, `${variant}-`));
  const home = join(root, "home");
  const folder = join(root, "project");
  const registry = await startRegistryWireFixture();
  let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
  try {
    await mkdir(home);
    await mkdir(folder);
    await registry.publishPackage(initialArchive);
    host = await startPackagedServe(home, { PSTDIO_EXTENSION_RELEASE_REF: `psx:${registry.origin}` });
    const { baseUrl, descriptor: runtime } = host;
    const post = async <T>(path: string, body?: unknown) => {
      const result = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { ...runtimeAuthorization(runtime), "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!result.ok) throw new Error(`${path} returned ${result.status}: ${await result.text()}`);
      return result.json() as Promise<T>;
    };
    const { id } = await post<{ id: string }>(
      "/v1/projects",
      folderProjectInput({ name: `Planner upgrade · ${variant}` }, folder),
    );
    const project = `/v1/projects/${id}/extensions`;
    const { extension } = await post<InstallExtensionResponse>(`${project}/install`, {
      source: { kind: "catalog", name: "pstdio.planner" },
    });
    if (extension.version !== oldVersion) throw new Error("Initial upgrade fixture is missing.");
    const listTickets = async () => {
      const command = await post<{ outcome: { ok: boolean; reason?: string } }>(
        `${project}/commands/pstdio.planner.command.list-tickets/execute`,
        {},
      );
      if (!command.outcome.ok) throw new Error(command.outcome.reason ?? "The Planner command failed.");
    };
    // Model an existing installation. One-time Planner migrations and initial data seeding
    // belong to the old release, ahead of the measured upgrade.
    await listTickets();
    await registry.publishPackage(sourceArchive);
    if (variant !== "source") await registry.publishBundle(version, await Bun.file(runtimeArchive).bytes());
    if (seedConflict) {
      const installedManifest = join(extension.sourcePath, "package.json");
      const edited = { ...(await Bun.file(installedManifest).json()), description: "My local Planner description" };
      await Bun.write(installedManifest, JSON.stringify(edited));
      for (const extensionId of ["pstdio.session-browser", "pstdio.harness-codex"]) {
        const tool = catalog.sources.find(({ id }) => id === extensionId);
        if (!tool) throw new Error(`The conflict demo requires the packaged ${extensionId} source.`);
        await registry.publishPackage(join(archives, `${encodeURIComponent(tool.installName)}.tgz`));
        await post<InstallExtensionResponse>(`${project}/install`, {
          source: { kind: "catalog", name: extensionId },
        });
      }
    }
    if (variant === "warm") await waitForPrefetch(home, `${baseUrl}${project}`, runtimeAuthorization(runtime));
    if (leaveOpen) {
      const { url } = await post<{ url: string }>("/runtime/browser-login");
      const dashboard = new URL(url);
      dashboard.pathname = `/projects/${id}/extensions`;
      console.log(`Open ${dashboard.href}\nPlanner ${oldVersion} → ${version} is ready. Press Ctrl+C to stop.`);
      console.log(`Demo home: ${home}`);
      if (seedConflict) console.log("The working manifest has a local edit for the upgrade review.");
      await new Promise<void>((done) => {
        process.once("SIGINT", done);
        process.once("SIGTERM", done);
      });
      return;
    }
    const started = performance.now();
    const { upgradeMs, usableMs } = inBrowser
      ? await (await import("./measure-planner-upgrade-browser")).measurePlannerBrowserUpgrade({
          runtime,
          projectId: id,
          extensionId: extension.id,
          displayName: extension.displayName,
          previousVersion: oldVersion,
          version,
        })
      : await (async () => {
          const result = await post<UpgradeProjectExtensionResponse>(`${project}/${extension.id}/upgrade`);
          const upgradeMs = Math.round(performance.now() - started);
          if (result.extension.version !== version)
            throw new Error("The upgrade did not activate the published version.");
          await listTickets();
          return { upgradeMs, usableMs: Math.round(performance.now() - started) };
        })();
    const sample = {
      variant,
      measurement: inBrowser ? "browser" : "api",
      iteration,
      upgradeMs,
      usableMs,
      firstCommandMs: usableMs - upgradeMs,
      bundleBytes: variant === "source" ? 0 : descriptor.sizeBytes,
      platform: `${process.platform}-${process.arch}`,
      version,
    };
    console.log(JSON.stringify(sample));
    return sample;
  } finally {
    if (host) await stopProcess(host.child);
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
};

try {
  const initial = join(scratch, "initial");
  await unpackExtension(await Bun.file(sourceArchive).bytes(), initial, planner);
  const manifest = join(initial, "package.json");
  await Bun.write(manifest, JSON.stringify({ ...(await Bun.file(manifest).json()), version: oldVersion }));
  await Bun.write(initialArchive, (await packExtensionSource(initial)).bytes);
  if (interactive) await runSample(interactive, 1, true);
  else {
    const measurements: { variant: Variant; upgradeMs: number; usableMs: number }[] = [];
    for (let iteration = 1; iteration <= samples; iteration++) {
      for (const [index] of variants.entries()) {
        const variant = variants[(index + iteration - 1) % variants.length]!;
        const result = await runSample(variant, iteration, false);
        if (result) measurements.push(result);
      }
    }
    const p95 = (samples: number[]) => samples.sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1];
    for (const variant of variants) {
      const values = measurements.filter((result) => result.variant === variant);
      console.log(
        JSON.stringify({
          variant,
          measurement: inBrowser ? "browser" : "api",
          count: values.length,
          p95UpgradeMs: p95(values.map((result) => result.upgradeMs)),
          p95UsableMs: p95(values.map((result) => result.usableMs)),
        }),
      );
    }
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}
