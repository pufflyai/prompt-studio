import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { homedir as osHomedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { readPackageManifest, readPackageManifestMetadata } from "pstdio-extensions";
import { expandHomePath, resolvePstdioHome as resolveRuntimePstdioHome } from "pstdio-paths";
import { createExtensionIgnoreMatcher } from "./extension-ignore";
import {
  checkExtensionSource,
  checkExtensionsRoot,
  formatExtensionsCheck,
  hashExtensionSource,
  readExtensionSourceMetadata,
} from "./extension-runtime";
import { prepareNamedSource } from "./extension-source-checkout";
import { hashExtensionDependencyInputs } from "./hash-extension-dependency-inputs";
import { installDependencies, shouldInstallDependencies } from "./install-extension-dependencies";
import { linkUsableNodeModules } from "./install-extension-source-node-modules";
import type {
  ExtensionEnableInput,
  InstallExtensionSourceInput,
  InstalledExtensionSource,
} from "./install-extension-source-types";

export {
  createSharedNamedSourceCheckout,
  namedSourceRef,
  prepareGitExtensionSource,
} from "./extension-source-checkout";
export type {
  ExtensionEnableInput,
  InstallExtensionSourceInput,
  InstalledExtensionSource,
} from "./install-extension-source-types";
export { checkExtensionsRoot, formatExtensionsCheck };

export const EXTENSION_INSTALLING_MARKER = ".pstdio-installing";

export class ExtensionAlreadyInstalledError extends Error {
  targetPath: string;

  constructor(targetPath: string) {
    super(`Installed extension already exists: ${targetPath}`);
    this.name = "ExtensionAlreadyInstalledError";
    this.targetPath = targetPath;
  }
}

export const toExtensionEnableInput = (installed: InstalledExtensionSource): ExtensionEnableInput => ({
  displayName: installed.metadata.displayName,
  extensionId: installed.metadata.id,
  manifest: installed.manifest,
  name: installed.metadata.name,
  sourceHash: installed.sourceHash,
  sourceKind: installed.source.kind === "named" ? "git" : "local_path",
  sourcePath: installed.targetPath,
  sourceRef: installed.source.ref ?? null,
  version: installed.metadata.version,
});

export const resolvePstdioHome = (input: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  homedir?: () => string;
}) => resolveRuntimePstdioHome(input);

const expandsHome = (path: string, homedir: () => string) => {
  return expandHomePath(path, homedir());
};

const isLocalSource = (source: string) =>
  source.startsWith("./") || source.startsWith("../") || source.startsWith("~/") || isAbsolute(source);

const validateInstallName = (installName: string) => {
  if (!installName.trim() || basename(installName) !== installName) {
    throw new Error(`Invalid extension install name: ${installName}`);
  }
};

const assertCanCopy = (sourcePath: string, targetPath: string) => {
  const source = resolve(sourcePath);
  const target = resolve(targetPath);
  const sourceToTarget = relative(source, target);
  const targetToSource = relative(target, source);
  const nested = (value: string) => value === "" || (!value.startsWith("..") && !isAbsolute(value));

  if (nested(sourceToTarget) || nested(targetToSource)) {
    throw new Error("Refusing to copy an extension into itself");
  }
};

const copyExtensionSource = (sourcePath: string, targetPath: string) => {
  mkdirSync(dirname(targetPath), { recursive: true });
  const matcher = createExtensionIgnoreMatcher(sourcePath, { ignoreGit: false });
  cpSync(sourcePath, targetPath, {
    filter: (path) => {
      const rel = relative(sourcePath, path).replaceAll("\\", "/");
      if (!rel) return true;
      if (rel === ".git" || rel.startsWith(".git/")) return true;
      if (matcher.ignores(rel)) return false;
      return true;
    },
    recursive: true,
  });
};

const removeDirectory = (path: string) => rmSync(path, { recursive: true, force: true });

// Cleanup must not replace a completed install or the error that caused an install to fail.
export const removePathBestEffort = (path: string, remove: (path: string) => void = removeDirectory) => {
  try {
    remove(path);
  } catch {}
};

const promotePreparedSource = (
  preparedPath: string,
  targetPath: string,
  replaceExisting: boolean,
  preserveDependencies: boolean,
) => {
  const backupPath = join(dirname(preparedPath), ".previous");

  if (existsSync(targetPath)) {
    if (!replaceExisting) throw new ExtensionAlreadyInstalledError(targetPath);
    renameSync(targetPath, backupPath);
  }

  try {
    renameSync(preparedPath, targetPath);
    const previousNodeModules = join(backupPath, "node_modules");
    if (preserveDependencies && existsSync(previousNodeModules)) {
      renameSync(previousNodeModules, join(targetPath, "node_modules"));
    }
  } catch (error) {
    removePathBestEffort(targetPath);
    if (existsSync(backupPath)) renameSync(backupPath, targetPath);
    throw error;
  }
};

const linkInstalledDependencies = (sourcePath: string, targetPath: string, installPath: string) => {
  if (!existsSync(targetPath)) return false;
  if (hashExtensionDependencyInputs(sourcePath) !== hashExtensionDependencyInputs(targetPath)) return false;
  const installedNodeModules = join(targetPath, "node_modules");
  const stagedNodeModules = join(installPath, "node_modules");
  if (!existsSync(installedNodeModules) || existsSync(stagedNodeModules)) return false;
  symlinkSync(installedNodeModules, stagedNodeModules, "junction");
  return true;
};

type PreparedExtensionSource =
  | { kind: "local"; path: string; ref?: string }
  | { kind: "named"; name: string; path: string; ref: string };

const prepareInstallDependencies = async (input: {
  installInput: InstallExtensionSourceInput;
  installPath: string;
  source: PreparedExtensionSource;
  targetPath: string;
}) => {
  const { installInput, installPath, source, targetPath } = input;
  let linkedInstalledDependencies = installInput.reuseInstalledDependencies
    ? linkInstalledDependencies(source.path, targetPath, installPath)
    : false;

  if (installInput.skipInstall && source.kind === "local") {
    linkUsableNodeModules(source.path, installPath);
  }

  if (installInput.skipInstall || !shouldInstallDependencies(installPath)) return linkedInstalledDependencies;

  if (linkedInstalledDependencies) {
    unlinkSync(join(installPath, "node_modules"));
    linkedInstalledDependencies = false;
  }
  await installDependencies(installPath, installInput);
  return linkedInstalledDependencies;
};

export const isLocalExtensionSource = (source: string) => isLocalSource(source);

export const formatAlreadyInstalledMessage = (error: ExtensionAlreadyInstalledError) =>
  `An extension is already installed at ${error.targetPath}.\n` +
  `Re-run with --force to replace it, or pick a different --name.`;

const resolveSource = async (input: InstallExtensionSourceInput, tempDir: string) => {
  const homedir = input.homedir ?? osHomedir;
  if (isLocalSource(input.source)) {
    const path = resolve(expandsHome(input.source, homedir));
    return { kind: "local" as const, path, ref: undefined };
  }

  const named = await (input.prepareNamedSource ?? prepareNamedSource)(
    input.source,
    tempDir,
    input.ref,
    input.signal,
    input.hostReleaseRef,
  );
  return { kind: "named" as const, name: input.source, path: named.path, ref: named.ref };
};

const failIfInvalidSource = (sourcePath: string) => {
  if (!existsSync(sourcePath) || !statSync(sourcePath).isDirectory()) {
    throw new Error(`Extension source folder not found: ${sourcePath}`);
  }
  if (!existsSync(join(sourcePath, "package.json"))) {
    throw new Error(`Extension source is missing package.json: ${sourcePath}`);
  }
};

const sourceScope = (sourcePath: string, allowUnsupportedApiVersion: boolean) => {
  const readManifest = allowUnsupportedApiVersion ? readPackageManifestMetadata : readPackageManifest;
  const { manifest, diagnostics } = readManifest(sourcePath);
  if (!manifest) {
    const first = diagnostics[0];
    throw new Error(first?.message ?? `Extension validation failed: ${sourcePath}`);
  }
  return { manifest, scope: manifest.pstdio?.scope ?? "user" };
};

const resolveExtensionsRoot = (input: InstallExtensionSourceInput, pstdioHome: string, sourcePath: string) => {
  const { manifest, scope } = sourceScope(sourcePath, input.allowUnsupportedApiVersion === true);
  if (scope === "repo") {
    if (!input.repoPath) {
      throw new Error(
        `Extension "${manifest.id}" declares pstdio.scope "repo" and must be installed from a linked repo.`,
      );
    }
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
  if (check.errorCount > 0 && !keepForRecovery) {
    throw new Error(`Extension validation failed:\n${formatExtensionsCheck(check)}`);
  }

  const loaded = compatibleSource ?? (keepForRecovery ? readExtensionSourceMetadata(installPath) : null);
  if (!loaded) throw new Error(`Extension validation failed:\n${formatExtensionsCheck(check)}`);

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

export const installExtensionSource = async (input: InstallExtensionSourceInput) => {
  const pstdioHome = resolvePstdioHome(input);
  const tempDir = mkdtempSync(join(tmpdir(), "pstdio-extension-source-"));
  let stagingRoot: string | null = null;

  try {
    input.signal?.throwIfAborted();
    const resolvedSource = await resolveSource(input, tempDir);
    input.signal?.throwIfAborted();
    failIfInvalidSource(resolvedSource.path);
    const extensionsRoot = resolveExtensionsRoot(input, pstdioHome, resolvedSource.path);

    const installName =
      input.installName ?? (resolvedSource.kind === "named" ? resolvedSource.name : basename(resolvedSource.path));
    validateInstallName(installName);

    const targetPath = join(extensionsRoot, installName);
    assertCanCopy(resolvedSource.path, targetPath);

    const targetExists = existsSync(targetPath);
    const reuseExisting = targetExists && input.existsOk && !input.force;

    if (targetExists && !input.force && !input.existsOk) {
      throw new ExtensionAlreadyInstalledError(targetPath);
    }

    let installPath = targetPath;
    if (!reuseExisting) {
      mkdirSync(extensionsRoot, { recursive: true });
      stagingRoot = mkdtempSync(join(dirname(extensionsRoot), ".extension-install-"));
      installPath = join(stagingRoot, installName);
      copyExtensionSource(resolvedSource.path, installPath);
    }

    const linkedInstalledDependencies = await prepareInstallDependencies({
      installInput: input,
      installPath,
      source: resolvedSource,
      targetPath,
    });
    input.signal?.throwIfAborted();

    const { check, loaded } = await validatePreparedInstall(
      installPath,
      extensionsRoot,
      input.allowUnsupportedApiVersion === true,
    );
    input.signal?.throwIfAborted();

    if (installPath !== targetPath) {
      const preserveDependencies = linkedInstalledDependencies;
      if (linkedInstalledDependencies) unlinkSync(join(installPath, "node_modules"));
      promotePreparedSource(installPath, targetPath, Boolean(input.force), preserveDependencies);
      for (const extension of check.extensions) extension.sourcePath = targetPath;
    }

    return {
      check,
      installName,
      manifest: loaded.manifest,
      metadata: loaded.metadata,
      source:
        resolvedSource.kind === "named"
          ? { kind: "named" as const, name: resolvedSource.name, ref: resolvedSource.ref }
          : { kind: "local" as const, path: resolvedSource.path, ref: resolvedSource.ref },
      sourceHash: hashExtensionSource(targetPath),
      targetPath,
    };
  } finally {
    if (stagingRoot) removePathBestEffort(stagingRoot);
    removePathBestEffort(tempDir);
  }
};
