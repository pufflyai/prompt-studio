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
import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import { readPackageManifest, readPackageManifestMetadata } from "pstdio-extensions";
import { expandHomePath, resolvePstdioHome as resolveRuntimePstdioHome } from "pstdio-paths";
import { createExtensionIgnoreMatcher } from "./extension-ignore";
import {
  checkExtensionSource,
  checkExtensionsRoot,
  type ExtensionMetadata,
  formatExtensionsCheck,
  hashExtensionSource,
  readExtensionSourceMetadata,
} from "./extension-runtime";
import { hashExtensionDependencyInputs } from "./hash-extension-dependency-inputs";
import {
  type CommandOptions,
  type CommandResult,
  installDependencies,
  runCommand,
  shouldInstallDependencies,
} from "./install-extension-dependencies";
import { linkUsableNodeModules } from "./install-extension-source-node-modules";

export { checkExtensionsRoot, formatExtensionsCheck };

export const PSTDIO_REPOSITORY_URL = "https://github.com/pufflyai/prompt-studio";
export const EXTENSION_INSTALLING_MARKER = ".pstdio-installing";

export class ExtensionAlreadyInstalledError extends Error {
  targetPath: string;

  constructor(targetPath: string) {
    super(`Installed extension already exists: ${targetPath}`);
    this.name = "ExtensionAlreadyInstalledError";
    this.targetPath = targetPath;
  }
}

export type InstallExtensionSourceInput = {
  /** Keep a managed source installed so the dashboard can repair it after an extension API change. */
  allowUnsupportedApiVersion?: boolean;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  existsOk?: boolean;
  force?: boolean;
  homedir?: () => string;
  installName?: string;
  repoPath?: string;
  isPackagedRuntime?: () => boolean;
  bunCacheDir?: string;
  prepareNamedSource?: (name: string, tempDir: string, ref?: string) => Promise<{ path: string; ref: string }>;
  /** Git ref for a named source. Omitting it takes the default branch, which only development does. */
  ref?: string;
  processExecPath?: string;
  reuseInstalledDependencies?: boolean;
  runCommand?: (command: string, args: string[], options: CommandOptions) => Promise<CommandResult>;
  saveLockfile?: boolean;
  skipInstall?: boolean;
  signal?: AbortSignal;
  source: string;
};

export type InstalledExtensionSource = {
  check: ExtensionsCheckResponse;
  installName: string;
  manifest: Record<string, unknown>;
  metadata: ExtensionMetadata;
  source:
    | { kind: "local"; path: string; ref?: string }
    | {
        kind: "named";
        name: string;
        ref: string;
      };
  sourceHash: string;
  targetPath: string;
};

export type ExtensionEnableInput = {
  displayName: string;
  extensionId: string;
  manifest: Record<string, unknown>;
  name: string;
  sourceHash: string;
  sourceKind: "git" | "local_path";
  sourcePath: string;
  sourceRef: string | null;
  version: string | null;
};

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

/**
 * Clones the extension monorepo and reports the commit that was checked out.
 *
 * The commit sha is the pin: a tag can be moved and a branch always moves, so recording the ref a
 * caller asked for would not tell us later what was actually installed. `ref` may be a tag, branch,
 * or sha; omitting it takes the default branch, which only the development flag does.
 */
const cloneRepoSparse = async (
  checkoutPath: string,
  paths: string[],
  run: (command: string, args: string[], options: { cwd: string }) => Promise<CommandResult>,
  ref?: string,
) => {
  const tempParent = dirname(checkoutPath);
  const cloneArgs = ["clone", "--depth", "1", "--filter=blob:none", "--sparse"];
  if (ref) cloneArgs.push("--branch", ref);
  const clone = await run("git", [...cloneArgs, PSTDIO_REPOSITORY_URL, checkoutPath], { cwd: tempParent });
  if (clone.exitCode !== 0) {
    const detail = clone.stderr.trim() || clone.stdout.trim();
    throw new Error(`Failed to clone ${PSTDIO_REPOSITORY_URL}${ref ? ` at ${ref}` : ""}: ${detail}`);
  }

  const sparse = await run("git", ["sparse-checkout", "set", ...paths], { cwd: checkoutPath });
  if (sparse.exitCode !== 0) {
    throw new Error(`Failed to fetch ${paths.join(", ")}: ${sparse.stderr.trim() || sparse.stdout.trim()}`);
  }

  const head = await run("git", ["rev-parse", "HEAD"], { cwd: checkoutPath });
  if (head.exitCode !== 0) {
    throw new Error(`Failed to resolve the installed commit: ${head.stderr.trim() || head.stdout.trim()}`);
  }

  return head.stdout.trim();
};

export const namedSourceRef = (commit: string, name: string) => `${PSTDIO_REPOSITORY_URL}@${commit}#extensions/${name}`;

const prepareNamedSource = async (name: string, tempDir: string, ref?: string) => {
  const checkoutPath = join(tempDir, "prompt-studio");
  const commit = await cloneRepoSparse(checkoutPath, [`extensions/${name}`], runCommand, ref);
  return {
    path: join(checkoutPath, "extensions", name),
    ref: namedSourceRef(commit, name),
  };
};

export const createSharedNamedSourceCheckout = async (
  names: string[],
  options: {
    ref?: string;
    runCommand?: (command: string, args: string[], opts: { cwd: string }) => Promise<CommandResult>;
  } = {},
) => {
  const tempDir = mkdtempSync(join(tmpdir(), "pstdio-extension-shared-"));
  const cleanup = () => rmSync(tempDir, { recursive: true, force: true });

  if (names.length === 0) {
    return { prepareNamedSource: prepareNamedSource, cleanup };
  }

  const checkoutPath = join(tempDir, "prompt-studio");
  let commit: string;
  try {
    commit = await cloneRepoSparse(
      checkoutPath,
      names.map((name) => `extensions/${name}`),
      options.runCommand ?? runCommand,
      options.ref,
    );
  } catch (error) {
    cleanup();
    throw error;
  }

  const shared = async (name: string) => ({
    path: join(checkoutPath, "extensions", name),
    ref: namedSourceRef(commit, name),
  });

  return { prepareNamedSource: shared, cleanup };
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

  const named = await (input.prepareNamedSource ?? prepareNamedSource)(input.source, tempDir, input.ref);
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
    const resolvedSource = await resolveSource(input, tempDir);
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

    const { check, loaded } = await validatePreparedInstall(
      installPath,
      extensionsRoot,
      input.allowUnsupportedApiVersion === true,
    );

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
