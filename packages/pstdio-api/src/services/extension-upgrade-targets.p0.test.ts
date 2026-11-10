import { expect, test } from "bun:test";
import type { BundledExtensionSources } from "pstdio-extensions/distribution";
import { namedSourceRef } from "../features/extensions/install-extension-source";
import { createExtensionUpgradeService, type ExtensionUpgradeServiceDeps } from "./extension-upgrade-service";

const ref = "a".repeat(40);
const bundledCommit = "b".repeat(40);
const source = (name: string, commit: string) => ({
  id: name,
  install_name: name,
  extension_id: `pstdio.${name}`,
  display_name: name,
  source_path: `/extensions/${name}`,
  source_ref: namedSourceRef(commit, name),
  source_hash: commit,
  source_kind: "git",
});
const planner = source("pstdio-planner", bundledCommit);
const canvas = source("canvas", ref);
const instance = { id: "instance", scope_id: "project", enabled: true };

const withBundledPlanner = async (run: () => Promise<void>) => {
  const manifest: BundledExtensionSources = {
    ref,
    commit: bundledCommit,
    sources: [
      {
        url: "https://github.com/pufflyai/prompt-studio",
        path: "extensions/pstdio-planner",
        installName: "pstdio-planner",
        id: "pstdio.pstdio-planner",
        version: "1.0.0",
        sha256: "c".repeat(64),
      },
    ],
  };
  const file = new File([JSON.stringify(manifest)], "extension-sources/manifest.json");
  const files = Bun.embeddedFiles as Blob[];
  files.unshift(file);
  try {
    await run();
  } finally {
    files.splice(files.indexOf(file), 1);
  }
};

const createService = (overrides: Partial<ExtensionUpgradeServiceDeps> = {}) =>
  createExtensionUpgradeService({
    release: { source: "git", ref },
    workspaceService: { getDefault: async () => null },
    extensionService: {
      getInstalledSource: async () => null as never,
      listProjectExtensionInstances: async () => [],
      getProjectExtensionInstance: async () =>
        ({ instance, installedSource: source("canvas", "d".repeat(40)) }) as never,
      registerInstalledSource: async () => canvas as never,
      enableInstalledSourceForProject: async () => {
        throw new Error("Must retain enablement");
      },
    },
    installExtensionSource: async () =>
      ({
        installName: "canvas",
        metadata: { id: "pstdio.canvas", displayName: "UI Canvas", version: "0.0.1" },
        manifest: { name: "canvas" },
        source: { kind: "named", name: "canvas", ref: canvas.source_ref },
        sourceHash: ref,
        targetPath: canvas.source_path,
      }) as never,
    ...overrides,
  });

test("an optional extension uses its Git release rather than another extension's bundled commit", () =>
  withBundledPlanner(async () => {
    const service = createService();
    expect(await service.canUpgrade(planner)).toBe(false);
    expect(await service.canUpgrade(canvas)).toBe(false);
  }));

test("updating an optional extension leaves current bundled extensions up to date", () =>
  withBundledPlanner(async () => {
    const service = createService();
    expect(await service.canUpgrade(planner)).toBe(false);
    await service.upgrade("project", "instance");
    expect(await service.canUpgrade(canvas)).toBe(false);
    expect(await service.canUpgrade(planner)).toBe(false);
    const restarted = createService();
    expect(await restarted.canUpgrade(canvas)).toBe(false);
    expect(await restarted.canUpgrade(planner)).toBe(false);
  }));

test("a failed release lookup recovers after a successful upgrade", async () => {
  let first = true;
  const service = createService({
    release: { source: "git", ref: "nightly" },
    resolveReleaseCommit: async () => {
      if (first) {
        first = false;
        throw new Error("Registry temporarily unavailable");
      }
      return ref;
    },
  });
  expect(await service.canUpgrade(source("canvas", "d".repeat(40)))).toBe(true);
  await service.upgrade("project", "instance");
  expect(await service.canUpgrade(canvas)).toBe(false);
});

test("a successful upgrade rechecks a symbolic release that advanced during installation", async () => {
  let target = "e".repeat(40);
  const service = createService({
    release: { source: "git", ref: "nightly" },
    resolveReleaseCommit: async () => target,
    installExtensionSource: async () => {
      target = ref;
      return {
        installName: "canvas",
        metadata: { id: "pstdio.canvas", displayName: "UI Canvas", version: "0.0.1" },
        manifest: { name: "canvas" },
        source: { kind: "named", name: "canvas", ref: canvas.source_ref },
        sourceHash: ref,
        targetPath: canvas.source_path,
      } as never;
    },
  });
  await service.upgrade("project", "instance");
  expect(await service.canUpgrade(canvas)).toBe(false);
});
