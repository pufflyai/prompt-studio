import { join } from "node:path";
import type { retainExtensionPreparation } from "pstdio-extensions";
import { resolvePstdioHome } from "pstdio-paths";
import type { ExtensionRelease } from "../app-config";
import { apiLogger } from "../lib/logger";

// Only unpack the host's own verified bytes. Source ownership, edits, scope, and
// runtime validation are checked by the installer after the database is ready.
export const warmInstalledUpgradeBundles = async (ref: string, signal: AbortSignal) => {
  const [
    { getExtensionApiVersionError },
    { releaseBundleHost },
    { readBundledExtensionSources },
    { runExtensionPreparation },
  ] = await Promise.all([
    import("pstdio-extensions"),
    import("pstdio-extensions/distribution"),
    import("../features/extensions/bundled-extension-source"),
    import("../features/extensions/extension-preparation"),
  ]);
  const bundle = await readBundledExtensionSources();
  if (!bundle || (ref !== bundle.ref && ref !== bundle.commit)) return;
  const root = join(resolvePstdioHome(), "extensions");
  const targets = bundle.sources.flatMap((source) => {
    const artifact = source.bundles?.find((b) => b.host === releaseBundleHost() && b.sourceSha256 === source.sha256);
    return artifact ? [{ source, artifact }] : [];
  });
  for (const { source, artifact } of targets.sort((a, b) => b.artifact.sizeBytes - a.artifact.sizeBytes)) {
    if (signal.aborted) return;
    const manifest = await Bun.file(join(root, source.installName, "package.json"))
      .json()
      .catch(() => null);
    if (
      typeof manifest?.engines?.pstdio !== "string" ||
      !getExtensionApiVersionError(source.installName, manifest.engines.pstdio)
    )
      continue;
    await runExtensionPreparation(
      "release.prefetch",
      {
        origin: { url: source.url, path: source.path },
        ref,
        sha256: artifact.sha256,
      },
      { signal, priority: "background", resources: [`release:${artifact.sha256}`] },
    );
  }
};

export const createUpgradeBundleWarmup = (release: ExtensionRelease | null) => {
  const controller = new AbortController();
  let starting: Promise<void> | undefined;
  let releasePreparation: ReturnType<typeof retainExtensionPreparation> | undefined;
  const stop = () => controller.abort();
  const report = (err: unknown) => {
    if (!controller.signal.aborted) apiLogger.debug({ err }, "Bundled tools will be prepared during installation");
  };
  return {
    start() {
      if (release?.source !== "git" || !Bun.embeddedFiles.length || starting) return;
      starting = import("pstdio-extensions")
        .then(({ retainExtensionPreparation }) => {
          if (controller.signal.aborted) return;
          releasePreparation = retainExtensionPreparation();
          void warmInstalledUpgradeBundles(release.ref, controller.signal).catch(report);
        })
        .catch(report);
    },
    stop,
    async close() {
      stop();
      await starting;
      await releasePreparation?.();
    },
  };
};
