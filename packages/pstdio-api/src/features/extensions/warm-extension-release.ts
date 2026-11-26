import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RegistryRelease } from "pstdio-extensions/distribution";
import { prepareBundledExtensionSource } from "./bundled-extension-source";
import { copyExtensionSource } from "./copy-extension-source";
import { hashExtensionSource } from "./extension-runtime";
import { trackPreparationStage } from "./preparation-stages";
import { importPreparedReleaseBundle } from "./prepared-release-bundle";
import { resolveInstallSource } from "./resolve-install-source";

export type RegistryReleaseTarget = { url: string; id: string; release: RegistryRelease };
export type BundledReleaseTarget = { origin: { url: string; path: string }; ref: string; sha256: string };
export type ExtensionReleasePrefetchTarget = RegistryReleaseTarget | BundledReleaseTarget;

/** Fetch and verify release artifacts without executing the pending extension. */
export const warmExtensionRelease = async (target: ExtensionReleasePrefetchTarget, signal: AbortSignal) => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-extension-prefetch-"));
  const stage = trackPreparationStage([root]);
  try {
    const source =
      "origin" in target
        ? await prepareBundledExtensionSource(target.origin, root, target.ref, { signal })
        : await resolveInstallSource({ registrySource: target, source: target.id, signal }, root);
    if (!source || !("runtimeBundle" in source) || !source.runtimeBundle) return;
    if ("origin" in target && source.runtimeBundle.descriptor.sha256 !== target.sha256) return;
    const normalized = join(root, "normalized");
    await copyExtensionSource(source.path, normalized);
    signal.throwIfAborted();
    const hash = hashExtensionSource(normalized);
    await importPreparedReleaseBundle(source.runtimeBundle, normalized, hash, true);
  } finally {
    await rm(root, { recursive: true, force: true });
    stage.release();
  }
};
