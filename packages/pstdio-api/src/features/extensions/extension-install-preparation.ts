import { existsSync, mkdirSync, mkdtempSync, unlinkSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import {
  extensionStorageDirectory,
  readPackageManifest,
  readPackageManifestMetadata,
  remapPackageAssets,
} from "pstdio-extensions";
import { parseRegistrySourceRef } from "pstdio-extensions/distribution";
import { resolvePstdioHome as resolveRuntimePstdioHome } from "pstdio-paths";
import { traceSetupPhase } from "../../lib/setup-phase";
import { prepareInstallCandidate, validatePreparedInstall } from "./extension-install-candidate";
import { assertCanCopy, failIfInvalidSource, isSameDirectory, validateInstallName } from "./extension-install-paths";
import { retainPreparedInstall } from "./extension-install-transaction";
import { checkExtensionsRoot, formatExtensionsCheck, hashExtensionSource } from "./extension-runtime";
import {
  assertExtensionUpgradeWorkingTree,
  prepareExtensionUpgradeBaseline,
  protectUpgradeDestination,
  rememberExtensionUpgradeBaseline,
  stageExtensionSource,
} from "./extension-upgrade-baseline";
import { fingerprintUpgradeWorkingTree } from "./extension-upgrade-working-tree";
import type {
  ExtensionEnableInput,
  InstallExtensionSourceInput,
  InstalledExtensionSource,
} from "./install-extension-source-types";
import { installedIdentityPath } from "./installed-identity-path";
import { trackPreparationStage } from "./preparation-stages";
import { ExtensionAlreadyInstalledError, promotePreparedSource } from "./promote-extension-source";
import { resolveInstallSource } from "./resolve-install-source";
import { verifiedInstallOrigin } from "./verified-install-origin";

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

import { ExtensionValidationFailedError, RepoScopedExtensionNeedsProjectFolderError } from "./extension-install-errors";

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

const resolveExtensionsRoot = (
  input: InstallExtensionSourceInput,
  pstdioHome: string,
  source: ReturnType<typeof sourceScope>,
) => {
  const { manifest, scope } = source;
  if ((input.scope ?? scope) === "repo") {
    if (!input.repoPath) throw new RepoScopedExtensionNeedsProjectFolderError(manifest.id);
    return join(input.repoPath, ".pstdio", "extensions");
  }

  return join(pstdioHome, "extensions");
};

const resolveInstallName = (
  input: InstallExtensionSourceInput,
  source: Awaited<ReturnType<typeof resolveInstallSource>>,
  manifest: ReturnType<typeof sourceScope>["manifest"],
) => {
  if (input.installName !== undefined) return input.installName;
  if (source.ref?.endsWith(".tgz")) return manifest.id;
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
    upgradeBaseline?: string;
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
        upgradeFromVersion: input.upgradeFromVersion,
        upgradeBaseline: prepared.upgradeBaseline,
        revision: loaded.preparedRevision,
      });
      return { snapshot, loaded, sourceHash, installation };
    }
    try {
      const { upgradeBaseline } = prepared;
      await promotePreparedSource(
        installPath,
        targetPath,
        Boolean(input.force),
        preserveDependencies,
        undefined,
        upgradeBaseline
          ? (previousPath) => assertExtensionUpgradeWorkingTree(previousPath, upgradeBaseline)
          : undefined,
      );
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

const stageInstallSource = async (
  source: Awaited<ReturnType<typeof resolveInstallSource>>,
  installPath: string,
  home: string,
  review: InstallExtensionSourceInput["reviewedUpgrade"],
) => {
  if (!review) return stageExtensionSource(source, installPath, home);
  if (source.kind !== "named") throw new Error("A reviewed upgrade requires a pinned release.");
  await cp(source.path, installPath, { recursive: true, verbatimSymlinks: true });
  if (fingerprintUpgradeWorkingTree(installPath) !== review.stagedFingerprint)
    throw new Error("The staged extension changed. Open a fresh upgrade review.");
  rememberExtensionUpgradeBaseline(home, source.ref, review.originalReleasePath);
};

const prepareExpectedWorkingTree = (input: InstallExtensionSourceInput, home: string, tempDir: string) => {
  if (!input.reviewedUpgrade || !input.upgradeBase)
    return prepareExtensionUpgradeBaseline(home, input.upgradeBase, tempDir, input.signal);
  assertExtensionUpgradeWorkingTree(input.upgradeBase.path, input.reviewedUpgrade.workingFingerprint);
  return input.reviewedUpgrade.workingFingerprint;
};

const targetPathForInstall = (input: InstallExtensionSourceInput, root: string, directory: string, identity: string) =>
  input.allocateSeparateSource
    ? join(root, directory)
    : installedIdentityPath(root, directory, identity, input.installedSourcePath);

export const prepareAndInstallExtensionSource = async (input: InstallExtensionSourceInput) => {
  const pstdioHome = resolvePstdioHome(input);
  const tempDir = mkdtempSync(join(tmpdir(), "pstdio-extension-source-"));
  const stage = trackPreparationStage([tempDir]);
  let stagingRoot: string | null = null;
  let retained = false;

  try {
    input.signal?.throwIfAborted();
    const upgradeBaseline = await prepareExpectedWorkingTree(input, pstdioHome, tempDir);
    const resolvedSource = await resolveInstallSource(input, tempDir);
    input.signal?.throwIfAborted();
    failIfInvalidSource(resolvedSource.path);
    const source = sourceScope(resolvedSource.path, input.allowUnsupportedApiVersion === true);
    if (input.upgradeFromVersion && Bun.semver.order(source.manifest.version, input.upgradeFromVersion) < 0)
      throw new Error(`Cannot downgrade extension from ${input.upgradeFromVersion} to ${source.manifest.version}.`);
    const assertReservedIdentity = (id: string) => {
      if (input.expectedIdentity && canonicalExtensionId(id) !== input.expectedIdentity)
        throw new Error("Extension identity changed after reserving its installation destination");
    };
    assertReservedIdentity(source.manifest.id);
    const extensionsRoot = resolveExtensionsRoot(input, pstdioHome, source);

    const installName = resolveInstallName(input, resolvedSource, source.manifest);
    validateInstallName(installName);

    const directoryName = installName === source.manifest.id ? extensionStorageDirectory(installName) : installName;
    const targetPath = targetPathForInstall(input, extensionsRoot, directoryName, source.manifest.id);
    const targetExists = existsSync(targetPath);
    const inPlace = targetExists && isSameDirectory(resolvedSource.path, targetPath);
    protectUpgradeDestination(input.upgradeBase, targetPath, targetExists && !inPlace);
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
        stageInstallSource(resolvedSource, installPath, pstdioHome, input.reviewedUpgrade),
      );
    }

    const { check, loaded, sourceHash, linkedInstalledDependencies } = await prepareInstallCandidate({
      input,
      installPath,
      targetPath,
      extensionsRoot,
      installName,
      source: resolvedSource,
      preserveExistingSource: reuseExisting,
    });
    assertReservedIdentity(loaded.metadata.id);
    await Bun.sleep(0);
    input.signal?.throwIfAborted();
    const origin =
      !input.reviewedUpgrade &&
      !reuseExisting &&
      verifiedInstallOrigin(input, resolvedSource, loaded.metadata.id, targetPath);
    const trusted =
      origin && loaded.preparedRevision
        ? { ...loaded, preparedRevision: { ...loaded.preparedRevision, verifiedInstall: origin } }
        : loaded;
    const {
      snapshot,
      loaded: installedSource,
      sourceHash: installedHash,
      installation,
    } = await finishPreparedInstall(input, {
      check,
      loaded: trusted,
      sourceHash,
      installPath,
      targetPath,
      extensionsRoot,
      linkedInstalledDependencies,
      upgradeBaseline,
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
