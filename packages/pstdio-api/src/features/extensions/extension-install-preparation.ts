import { existsSync, mkdirSync, mkdtempSync, unlinkSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import {
  extensionStorageDirectory,
  readPackageManifest,
  readPackageManifestMetadata,
  remapPackageAssets,
} from "pstdio-extensions";
import { parseRegistrySourceRef } from "pstdio-extensions/distribution";
import { resolvePstdioHome as resolveRuntimePstdioHome } from "pstdio-paths";
import { traceSetupPhase } from "../../lib/setup-phase";
import { copyExtensionSource } from "./copy-extension-source";
import { assertCanCopy, failIfInvalidSource, isSameDirectory, validateInstallName } from "./extension-install-paths";
import { retainPreparedInstall } from "./extension-install-transaction";
import {
  checkExtensionSource,
  checkExtensionsRoot,
  formatExtensionsCheck,
  hashExtensionSource,
  type LoadedExtension,
  readExtensionSourceMetadata,
} from "./extension-runtime";
import type {
  ExtensionEnableInput,
  InstallExtensionSourceInput,
  InstalledExtensionSource,
} from "./install-extension-source-types";
import { trackPreparationStage } from "./preparation-stages";
import { prepareInstallDependencies } from "./prepare-extension-dependencies";
import { ExtensionAlreadyInstalledError, promotePreparedSource } from "./promote-extension-source";
import { resolveInstallSource } from "./resolve-install-source";
import { validateExtensionWebviews } from "./validate-extension-webviews";

export { dashboardExtensionHostCapabilities } from "pstdio-extensions";
export {
  createSharedNamedSourceCheckout,
  namedSourceRef,
  prepareGitExtensionSource,
  prepareReleaseExtensionSource,
} from "./extension-source-checkout";
export type {
  ExtensionEnableInput,
  InstallExtensionSourceInput,
  InstalledExtensionSource,
} from "./install-extension-source-types";
export { checkExtensionsRoot, formatExtensionsCheck };

export const EXTENSION_INSTALLING_MARKER = ".pstdio-installing";

export { ExtensionValidationFailedError, RepoScopedExtensionNeedsProjectFolderError } from "./extension-install-errors";
export { ExtensionAlreadyInstalledError } from "./promote-extension-source";

import {
  checkFailed,
  ExtensionValidationFailedError,
  RepoScopedExtensionNeedsProjectFolderError,
} from "./extension-install-errors";

const installedSourceKind = (installed: InstalledExtensionSource) => {
  if (parseRegistrySourceRef(installed.source.ref)) return "registry" as const;
  return installed.source.kind === "named" ? ("git" as const) : ("local_path" as const);
};

export const toExtensionEnableInput = (installed: InstalledExtensionSource): ExtensionEnableInput => ({
  displayName: installed.metadata.displayName,
  extensionId: installed.metadata.id,
  manifest: installed.manifest,
  name: installed.metadata.name,
  sourceHash: installed.sourceHash,
  sourceKind: installedSourceKind(installed),
  sourcePath: installed.targetPath,
  sourceRef: installed.source.ref ?? null,
  version: installed.metadata.version,
  ...(installed.preparedRevision ? { preparedRevision: installed.preparedRevision } : {}),
  ...(installed.installation ? { installation: installed.installation } : {}),
});

export const resolvePstdioHome = (input: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  homedir?: () => string;
}) => resolveRuntimePstdioHome(input);

const removeDirectory = (path: string) => rm(path, { recursive: true, force: true });

// Cleanup must not replace a completed install or the error that caused an install to fail.
export const removePathBestEffort = async (
  path: string,
  remove: (path: string) => void | Promise<void> = removeDirectory,
) => {
  try {
    await remove(path);
  } catch {}
};

export { isLocalExtensionSource } from "./extension-install-paths";

export const formatAlreadyInstalledMessage = (error: ExtensionAlreadyInstalledError) =>
  `An extension is already installed at ${error.targetPath}.\n` +
  `Re-run with --force to replace it, or pick a different --name.`;

const sourceScope = (sourcePath: string, allowUnsupportedApiVersion: boolean) => {
  const readManifest = allowUnsupportedApiVersion ? readPackageManifestMetadata : readPackageManifest;
  const { manifest, diagnostics } = readManifest(sourcePath);
  if (!manifest) {
    const first = diagnostics[0];
    throw new ExtensionValidationFailedError(first?.message ?? `Extension validation failed: ${sourcePath}`);
  }
  return { manifest, scope: manifest.pstdio?.scope ?? "user" };
};

const resolveExtensionsRoot = (input: InstallExtensionSourceInput, pstdioHome: string, sourcePath: string) => {
  const { manifest, scope } = sourceScope(sourcePath, input.allowUnsupportedApiVersion === true);
  if ((input.scope ?? scope) === "repo") {
    if (!input.repoPath) throw new RepoScopedExtensionNeedsProjectFolderError(manifest.id);
    return join(input.repoPath, ".pstdio", "extensions");
  }

  return join(pstdioHome, "extensions");
};

const validatePreparedInstall = async (
  installPath: string,
  extensionsRoot: string,
  allowUnsupportedApiVersion: boolean,
) => {
  const { check, loaded: compatibleSource } = await checkExtensionSource(installPath, extensionsRoot);
  const unsupportedApiOnly =
    check.errorCount > 0 &&
    check.diagnostics
      .filter((diagnostic) => diagnostic.severity === "error")
      .every((diagnostic) => diagnostic.code === "extension_manifest_unsupported_api_version");
  const keepForRecovery = allowUnsupportedApiVersion && unsupportedApiOnly;
  if (check.errorCount > 0 && !keepForRecovery) throw checkFailed(check);

  const loaded: LoadedExtension | null =
    compatibleSource ?? (keepForRecovery ? readExtensionSourceMetadata(installPath) : null);
  if (!loaded) throw checkFailed(check);

  if (keepForRecovery && check.extensions.length === 0) {
    check.extensions.push({
      id: loaded.metadata.id,
      name: loaded.metadata.name,
      displayName: loaded.metadata.displayName,
      sourcePath: installPath,
      version: loaded.metadata.version,
      description: loaded.metadata.description,
    });
  }

  return { check, loaded };
};

const resolveInstallName = (
  input: InstallExtensionSourceInput,
  source: Awaited<ReturnType<typeof resolveInstallSource>>,
) => {
  if (input.installName !== undefined) return input.installName;
  if (source.ref?.endsWith(".tgz")) return sourceScope(source.path, false).manifest.id;
  return source.kind === "named" ? source.name : basename(source.path);
};

const canReuseConcurrentInstall = (input: InstallExtensionSourceInput, error: unknown) =>
  !input.force && input.existsOk === true && error instanceof ExtensionAlreadyInstalledError;

const finishPreparedInstall = async (
  input: InstallExtensionSourceInput,
  prepared: Awaited<ReturnType<typeof validatePreparedInstall>> & {
    installPath: string;
    targetPath: string;
    extensionsRoot: string;
    linkedInstalledDependencies: boolean;
    sourceHash: string;
  },
) => {
  let { check, loaded, sourceHash } = prepared;
  const { installPath, targetPath, extensionsRoot, linkedInstalledDependencies } = prepared;
  let snapshot = { check, manifest: loaded.manifest };
  if (installPath !== targetPath) {
    // Resolve asset bases while staging still exists, before its folder is promoted.
    snapshot = remapPackageAssets(snapshot, installPath, targetPath) as typeof snapshot;
    const preserveDependencies = linkedInstalledDependencies;
    if (linkedInstalledDependencies) unlinkSync(join(installPath, "node_modules"));
    if (input.retainBackup) {
      const installation = retainPreparedInstall({
        root: dirname(installPath),
        installPath,
        targetPath,
        sourceHash,
        preserveDependencies,
        replaceExisting: Boolean(input.force),
        revision: loaded.preparedRevision,
      });
      return { snapshot, loaded, sourceHash, installation };
    }
    try {
      await promotePreparedSource(installPath, targetPath, Boolean(input.force), preserveDependencies);
      for (const extension of snapshot.check.extensions)
        extension.sourcePath = join(targetPath, relative(installPath, extension.sourcePath));
    } catch (error) {
      if (!canReuseConcurrentInstall(input, error)) throw error;
      // Another missing-only install won the target. Return its validated contents,
      // rather than reporting a setup warning or claiming the losing staged version.
      ({ check, loaded } = await validatePreparedInstall(
        targetPath,
        extensionsRoot,
        input.allowUnsupportedApiVersion === true,
      ));
      sourceHash = hashExtensionSource(targetPath);
      snapshot = { check, manifest: loaded.manifest };
    }
  }
  return { snapshot, loaded, sourceHash, installation: undefined };
};

export const prepareAndInstallExtensionSource = async (input: InstallExtensionSourceInput) => {
  const pstdioHome = resolvePstdioHome(input);
  const tempDir = mkdtempSync(join(tmpdir(), "pstdio-extension-source-"));
  const stage = trackPreparationStage([tempDir]);
  let stagingRoot: string | null = null;
  let retained = false;

  try {
    input.signal?.throwIfAborted();
    const resolvedSource = await resolveInstallSource(input, tempDir);
    input.signal?.throwIfAborted();
    failIfInvalidSource(resolvedSource.path);
    const extensionsRoot = resolveExtensionsRoot(input, pstdioHome, resolvedSource.path);

    const installName = resolveInstallName(input, resolvedSource);
    validateInstallName(installName);

    const directoryName =
      installName === sourceScope(resolvedSource.path, input.allowUnsupportedApiVersion === true).manifest.id
        ? extensionStorageDirectory(installName)
        : installName;
    const targetPath = join(extensionsRoot, directoryName);
    const targetExists = existsSync(targetPath);
    const inPlace = targetExists && isSameDirectory(resolvedSource.path, targetPath);
    if (!inPlace) assertCanCopy(resolvedSource.path, targetPath);

    const reuseExisting = inPlace || (targetExists && input.existsOk === true && !input.force);

    if (!inPlace && targetExists && !input.force && !input.existsOk) {
      throw new ExtensionAlreadyInstalledError(targetPath);
    }

    let installPath = targetPath;
    if (!reuseExisting) {
      mkdirSync(extensionsRoot, { recursive: true });
      stagingRoot = mkdtempSync(join(dirname(extensionsRoot), ".extension-install-"));
      stage.add(stagingRoot);
      installPath = join(stagingRoot, directoryName);
      await traceSetupPhase("extension.source_copy", { extension: installName }, () =>
        copyExtensionSource(resolvedSource.path, installPath),
      );
    }

    const linkedInstalledDependencies = await traceSetupPhase(
      "extension.prepare_dependencies",
      { extension: installName },
      () =>
        prepareInstallDependencies({
          installInput: input,
          installPath,
          source: resolvedSource,
          targetPath,
        }),
    );
    input.signal?.throwIfAborted();

    const { check, loaded } = await traceSetupPhase("extension.validate", { extension: installName }, () =>
      validatePreparedInstall(installPath, extensionsRoot, input.allowUnsupportedApiVersion === true),
    );
    input.signal?.throwIfAborted();

    // A replacement must activate every managed view before the working source is replaced.
    await validateExtensionWebviews(loaded, installPath, installName, input.signal);
    const sourceHash = await traceSetupPhase("extension.source_hash", { extension: installName }, async () =>
      hashExtensionSource(installPath),
    );
    await Bun.sleep(0);
    input.signal?.throwIfAborted();
    const {
      snapshot,
      loaded: installedSource,
      sourceHash: installedHash,
      installation,
    } = await finishPreparedInstall(input, {
      check,
      loaded,
      sourceHash,
      installPath,
      targetPath,
      extensionsRoot,
      linkedInstalledDependencies,
    });

    retained = Boolean(installation);
    return {
      ...snapshot,
      ...(installation ? { installation } : {}),
      ...(installedSource.preparedRevision ? { preparedRevision: installedSource.preparedRevision } : {}),
      installName,
      metadata: installedSource.metadata,
      source:
        resolvedSource.kind === "named"
          ? { kind: "named" as const, name: resolvedSource.name, ref: resolvedSource.ref }
          : { kind: "local" as const, path: resolvedSource.path, ref: resolvedSource.ref },
      sourceHash: installedHash,
      targetPath,
    };
  } finally {
    if (stagingRoot && !retained) await removePathBestEffort(stagingRoot);
    await removePathBestEffort(tempDir);
    stage.release();
  }
};
