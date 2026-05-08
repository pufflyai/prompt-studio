import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir as osHomedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import { expandHomePath, resolvePstdioHome as resolveRuntimePstdioHome } from "pstdio-paths";
import { isPackagedRuntime, resolveManagedBunCommand } from "./extension-bun-runner";
import { createExtensionIgnoreMatcher } from "./extension-ignore";
import {
  checkExtensionSource,
  checkExtensionsRoot,
  type ExtensionMetadata,
  formatExtensionsCheck,
  hashExtensionSource,
  loadExtensionSource,
} from "./extension-runtime";

export { checkExtensionsRoot, formatExtensionsCheck };

const DEFAULT_REPO_URL = "https://github.com/pufflyai/prompt-studio";
const PACKAGE_MANAGERS = ["bun", "npm", "yarn"] as const;

type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export class ExtensionAlreadyInstalledError extends Error {
  targetPath: string;

  constructor(targetPath: string) {
    super(`Installed extension already exists: ${targetPath}`);
    this.name = "ExtensionAlreadyInstalledError";
    this.targetPath = targetPath;
  }
}

export type InstallExtensionSourceInput = {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  existsOk?: boolean;
  force?: boolean;
  homedir?: () => string;
  installName?: string;
  isCommandAvailable?: (command: string) => boolean | Promise<boolean>;
  isPackagedRuntime?: () => boolean;
  bunCacheDir?: string;
  prepareNamedSource?: (name: string, tempDir: string) => Promise<{ path: string; ref: string }>;
  processExecPath?: string;
  runCommand?: (
    command: string,
    args: string[],
    options: { cwd: string; env?: NodeJS.ProcessEnv },
  ) => Promise<CommandResult>;
  skipInstall?: boolean;
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
  namespace: string;
  sourceHash: string;
  sourceKind: "git" | "local_path";
  sourcePath: string;
  sourceRef: string | null;
  version: string | null;
};

export const toExtensionEnableInput = (installed: InstalledExtensionSource): ExtensionEnableInput => ({
  displayName: installed.metadata.name,
  extensionId: installed.metadata.id,
  manifest: installed.manifest,
  namespace: installed.metadata.namespace,
  sourceHash: installed.sourceHash,
  sourceKind: installed.source.kind === "named" ? "git" : "local_path",
  sourcePath: installed.targetPath,
  sourceRef: installed.source.ref ?? null,
  version: installed.metadata.version ?? null,
});

type CommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

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

const runCommand = (command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv }) =>
  new Promise<CommandResult>((resolveResult) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      resolveResult({ exitCode: 1, stdout: "", stderr: error.message });
    });
    child.on("close", (code) => {
      resolveResult({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });

const isCommandAvailable = async (command: string) => {
  if (typeof Bun.which === "function") return Bun.which(command) !== null;
  const result = await runCommand(command, ["--version"], { cwd: process.cwd() });
  return result.exitCode === 0;
};

const packageManagerFromPackageJson = (targetPath: string) => {
  const packageJsonPath = join(targetPath, "package.json");
  if (!existsSync(packageJsonPath)) return null;

  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { packageManager?: string };
  const declared = parsed.packageManager?.split("@")[0];
  return PACKAGE_MANAGERS.find((manager) => manager === declared) ?? null;
};

const packageManagerFromLockfile = (targetPath: string): PackageManager => {
  if (existsSync(join(targetPath, "bun.lock")) || existsSync(join(targetPath, "bun.lockb"))) return "bun";
  if (existsSync(join(targetPath, "yarn.lock"))) return "yarn";
  return "npm";
};

const selectPackageManager = async (targetPath: string, available: (command: string) => boolean | Promise<boolean>) => {
  const preferred = packageManagerFromPackageJson(targetPath) ?? packageManagerFromLockfile(targetPath);
  if (await available(preferred)) return preferred;

  for (const manager of PACKAGE_MANAGERS) {
    if (await available(manager)) return manager;
  }

  throw new Error("No package manager found on PATH. Install bun, yarn, or npm, or re-run with --skip-install.");
};

const installDependencies = async (
  targetPath: string,
  input: Pick<
    InstallExtensionSourceInput,
    "bunCacheDir" | "env" | "homedir" | "isCommandAvailable" | "isPackagedRuntime" | "processExecPath" | "runCommand"
  >,
) => {
  if (!existsSync(join(targetPath, "package.json"))) return;

  const run = input.runCommand ?? runCommand;
  const packaged = (input.isPackagedRuntime ?? isPackagedRuntime)();
  const manager = packaged
    ? "bun"
    : await selectPackageManager(targetPath, input.isCommandAvailable ?? isCommandAvailable);
  const command = packaged
    ? resolveManagedBunCommand({
        args: ["install"],
        bunCacheDir: input.bunCacheDir ?? join(resolvePstdioHome(input), "cache", "extension-bun-install"),
        env: (input.env ?? process.env) as NodeJS.ProcessEnv,
        isPackaged: true,
        processExecPath: input.processExecPath ?? process.execPath,
      })
    : { file: manager, args: ["install"], env: undefined };

  const result = await run(command.file, command.args, {
    cwd: targetPath,
    ...(command.env ? { env: command.env } : {}),
  });
  if (result.exitCode !== 0) {
    const details = result.stderr.trim() || result.stdout.trim();
    throw new Error(`Dependency install failed with ${manager}${details ? `: ${details}` : ""}`);
  }
};

const cloneRepoSparse = async (
  checkoutPath: string,
  paths: string[],
  run: (command: string, args: string[], options: { cwd: string }) => Promise<CommandResult>,
) => {
  const tempParent = dirname(checkoutPath);
  const clone = await run(
    "git",
    ["clone", "--depth", "1", "--filter=blob:none", "--sparse", DEFAULT_REPO_URL, checkoutPath],
    { cwd: tempParent },
  );
  if (clone.exitCode !== 0) {
    throw new Error(`Failed to clone ${DEFAULT_REPO_URL}: ${clone.stderr.trim() || clone.stdout.trim()}`);
  }

  const sparse = await run("git", ["sparse-checkout", "set", ...paths], { cwd: checkoutPath });
  if (sparse.exitCode !== 0) {
    throw new Error(`Failed to fetch ${paths.join(", ")}: ${sparse.stderr.trim() || sparse.stdout.trim()}`);
  }
};

const prepareNamedSource = async (name: string, tempDir: string) => {
  const checkoutPath = join(tempDir, "prompt-studio");
  await cloneRepoSparse(checkoutPath, [`extensions/${name}`], runCommand);
  return {
    path: join(checkoutPath, "extensions", name),
    ref: `${DEFAULT_REPO_URL}#main:extensions/${name}`,
  };
};

export const createSharedNamedSourceCheckout = async (
  names: string[],
  options: {
    runCommand?: (command: string, args: string[], opts: { cwd: string }) => Promise<CommandResult>;
  } = {},
) => {
  const tempDir = mkdtempSync(join(tmpdir(), "pstdio-extension-shared-"));
  const cleanup = () => rmSync(tempDir, { recursive: true, force: true });

  if (names.length === 0) {
    return { prepareNamedSource: prepareNamedSource, cleanup };
  }

  const checkoutPath = join(tempDir, "prompt-studio");
  try {
    await cloneRepoSparse(
      checkoutPath,
      names.map((name) => `extensions/${name}`),
      options.runCommand ?? runCommand,
    );
  } catch (error) {
    cleanup();
    throw error;
  }

  const shared = async (name: string) => ({
    path: join(checkoutPath, "extensions", name),
    ref: `${DEFAULT_REPO_URL}#main:extensions/${name}`,
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

  const named = await (input.prepareNamedSource ?? prepareNamedSource)(input.source, tempDir);
  return { kind: "named" as const, name: input.source, path: named.path, ref: named.ref };
};

const failIfInvalidSource = (sourcePath: string) => {
  if (!existsSync(sourcePath) || !statSync(sourcePath).isDirectory()) {
    throw new Error(`Extension source folder not found: ${sourcePath}`);
  }
  if (!existsSync(join(sourcePath, "extension.ts"))) {
    throw new Error(`Extension source is missing extension.ts: ${sourcePath}`);
  }
};

export const installExtensionSource = async (input: InstallExtensionSourceInput) => {
  const pstdioHome = resolvePstdioHome(input);
  const extensionsRoot = join(pstdioHome, "extensions");
  const tempDir = mkdtempSync(join(tmpdir(), "pstdio-extension-source-"));

  try {
    const resolvedSource = await resolveSource(input, tempDir);
    failIfInvalidSource(resolvedSource.path);

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

    if (targetExists && input.force) {
      rmSync(targetPath, { recursive: true, force: true });
    }

    if (!reuseExisting) {
      copyExtensionSource(resolvedSource.path, targetPath);
      if (!input.skipInstall) await installDependencies(targetPath, input);
    }

    const loaded = await loadExtensionSource(targetPath);
    const { check } = await checkExtensionSource(targetPath, extensionsRoot);
    if (check.errorCount > 0) {
      throw new Error(`Extension validation failed:\n${formatExtensionsCheck(check)}`);
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
    rmSync(tempDir, { recursive: true, force: true });
  }
};
