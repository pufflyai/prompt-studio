import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve, sep } from "node:path";
import type { ExtensionRuntime } from "../types/runtime";
import { detectPackageManager, type PackageManager } from "./detect-package-manager";
import { pstdioExtensionsRoot } from "./discovery";
import { isPackageManagerOnPath, runPackageInstall } from "./run-package-install";
import { loadExtensionRuntime } from "./runtime";

const ENTRYPOINT = "extension.ts";
const PACKAGE_MANIFEST = "package.json";
const DEFAULT_REPO_OWNER = "pufflyai";
const DEFAULT_REPO_NAME = "prompt-studio";
const DEFAULT_REPO_REF = "main";
const IGNORED_COPY_DIRS = new Set([
  "node_modules",
  ".git",
  "build",
  ".turbo",
  ".next",
  "coverage",
  ".cache",
  ".parcel-cache",
  ".vite",
  ".svelte-kit",
  ".nuxt",
]);

export type InstallSourceKind = "local" | "github";

export type ResolvedInstallSource = {
  kind: InstallSourceKind;
  rootPath: string;
  defaultInstallName: string;
  cleanup?: () => void;
};

export type FetchGithubExtensionInput = {
  owner: string;
  name: string;
  ref: string;
  extensionName: string;
};

export type InstallExtensionInput = {
  /** Either a path to a local folder or a named extension to fetch from the default repo. */
  source: string;
  /** Override the install folder name. */
  installName?: string;
  /** Replace an existing install at the target path. */
  force?: boolean;
  /** Repo ref (branch/tag/sha) for named installs. Defaults to "main". */
  ref?: string;
  /** Override the extensions root. Defaults to ~/.pstdio/extensions. */
  extensionsRoot?: string;
  /** Skip the post-copy dependency install step. */
  skipInstall?: boolean;
  /** Override package manager detection. */
  packageManager?: PackageManager;
};

export type DependencyInstallReport =
  | { ran: false; reason: "no_package_json" | "skipped" }
  | { ran: true; manager: PackageManager; command: string };

export type InstallExtensionDeps = {
  fetchGithubExtension?: (input: FetchGithubExtensionInput) => Promise<ResolvedInstallSource>;
};

export type InstalledExtensionRecord = {
  id: string;
  namespace: string;
  displayName: string;
  version?: string;
  sourcePath: string;
};

export type InstallExtensionResult = {
  installPath: string;
  installName: string;
  sourceKind: InstallSourceKind;
  extension: InstalledExtensionRecord | null;
  runtime: ExtensionRuntime;
  errorCount: number;
  warningCount: number;
  dependencyInstall: DependencyInstallReport;
};

export class ExtensionInstallError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ExtensionInstallError";
  }
}

const looksLikeFilePath = (value: string) => {
  if (value.startsWith(".") || value.startsWith("~") || isAbsolute(value)) return true;
  if (value.includes("/") || value.includes("\\")) return true;
  return false;
};

const basename = (path: string) => {
  const trimmed = path.replace(/[\\/]+$/u, "");
  const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
};

const expandHome = (path: string) => {
  if (!path.startsWith("~")) return path;
  const home = process.env.HOME ?? "";
  return path.replace(/^~/u, home);
};

const isSubPath = (parent: string, child: string) => {
  const parentNorm = resolve(parent) + sep;
  const childNorm = resolve(child) + sep;
  return childNorm.startsWith(parentNorm);
};

const resolveLocalSource = (source: string): ResolvedInstallSource => {
  const expanded = expandHome(source);
  const absolute = resolve(expanded);

  if (!existsSync(absolute)) {
    throw new ExtensionInstallError("source_not_found", `Source folder does not exist: ${absolute}`);
  }
  if (!statSync(absolute).isDirectory()) {
    throw new ExtensionInstallError("source_not_a_directory", `Source is not a directory: ${absolute}`);
  }
  if (!existsSync(join(absolute, ENTRYPOINT))) {
    throw new ExtensionInstallError(
      "missing_entrypoint",
      `No ${ENTRYPOINT} found.\nExpected: ${join(absolute, ENTRYPOINT)}`,
    );
  }

  return {
    kind: "local",
    rootPath: absolute,
    defaultInstallName: basename(absolute),
  };
};

const fetchGithubExtensionDefault = async (input: FetchGithubExtensionInput): Promise<ResolvedInstallSource> => {
  const { owner, name, ref, extensionName } = input;
  const url = `https://codeload.github.com/${owner}/${name}/tar.gz/refs/heads/${ref}`;

  const tmpRoot = mkdtempSync(join(tmpdir(), "pstdio-ext-fetch-"));
  const cleanup = () => rmSync(tmpRoot, { recursive: true, force: true });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new ExtensionInstallError(
        "fetch_failed",
        `Failed to download ${owner}/${name}@${ref}: HTTP ${response.status}`,
      );
    }

    const tarballPath = join(tmpRoot, "archive.tar.gz");
    writeFileSync(tarballPath, Buffer.from(await response.arrayBuffer()));

    const extractDir = join(tmpRoot, "extracted");
    mkdirSync(extractDir, { recursive: true });

    const result = spawnSync("tar", ["-xzf", tarballPath, "-C", extractDir], { stdio: "pipe" });
    if (result.status !== 0) {
      throw new ExtensionInstallError(
        "extract_failed",
        `tar extraction failed: ${result.stderr?.toString() || "unknown error"}`,
      );
    }

    const topDir = readdirSync(extractDir, { withFileTypes: true }).find((entry) => entry.isDirectory());
    if (!topDir) {
      throw new ExtensionInstallError("extract_failed", "Tarball did not contain any top-level directory");
    }

    const candidate = join(extractDir, topDir.name, "extensions", extensionName);
    if (!existsSync(candidate) || !statSync(candidate).isDirectory()) {
      throw new ExtensionInstallError(
        "extension_not_in_repo",
        `Extension "${extensionName}" not found in ${owner}/${name}@${ref} under extensions/`,
      );
    }
    if (!existsSync(join(candidate, ENTRYPOINT))) {
      throw new ExtensionInstallError(
        "missing_entrypoint",
        `No ${ENTRYPOINT} found in extensions/${extensionName} of ${owner}/${name}@${ref}`,
      );
    }

    return {
      kind: "github",
      rootPath: candidate,
      defaultInstallName: extensionName,
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
};

const resolveSource = async (
  input: InstallExtensionInput,
  deps: InstallExtensionDeps,
): Promise<ResolvedInstallSource> => {
  if (looksLikeFilePath(input.source)) {
    return resolveLocalSource(input.source);
  }

  const fetcher = deps.fetchGithubExtension ?? fetchGithubExtensionDefault;
  return fetcher({
    owner: DEFAULT_REPO_OWNER,
    name: DEFAULT_REPO_NAME,
    ref: input.ref ?? DEFAULT_REPO_REF,
    extensionName: input.source,
  });
};

const copyExtensionFolder = (from: string, to: string) => {
  if (isSubPath(from, to) || isSubPath(to, from)) {
    throw new ExtensionInstallError("invalid_target", `Refusing to copy a folder into itself: ${from} -> ${to}`);
  }

  cpSync(from, to, {
    recursive: true,
    filter: (src) => {
      const name = basename(src);
      return !IGNORED_COPY_DIRS.has(name);
    },
  });
};

export const installExtensionSource = async (
  input: InstallExtensionInput,
  deps: InstallExtensionDeps = {},
): Promise<InstallExtensionResult> => {
  const extensionsRoot = input.extensionsRoot ?? pstdioExtensionsRoot();
  const resolved = await resolveSource(input, deps);

  try {
    const installName = input.installName ?? resolved.defaultInstallName;
    const installPath = join(extensionsRoot, installName);

    if (existsSync(installPath)) {
      if (!input.force) {
        throw new ExtensionInstallError(
          "already_installed",
          `Extension already installed at ${installPath}\nRun with --force to replace it.`,
        );
      }
      rmSync(installPath, { recursive: true, force: true });
    }

    mkdirSync(extensionsRoot, { recursive: true });
    copyExtensionFolder(resolved.rootPath, installPath);

    const dependencyInstall = installDependencies(installPath, input);

    const runtime = await loadExtensionRuntime({
      includeUserRoot: false,
      extensionFiles: [{ path: join(installPath, ENTRYPOINT), sourceKind: "local" }],
    });

    const errorCount = runtime.diagnostics.filter((d) => d.severity === "error").length;
    const warningCount = runtime.diagnostics.filter((d) => d.severity === "warning").length;

    if (errorCount > 0 && runtime.extensions.length === 0) {
      const failure = runtime.diagnostics.find((d) => d.severity === "error");
      throw new ExtensionInstallError(
        failure?.code ?? "invalid_extension",
        failure?.message ?? "Installed extension failed to load",
      );
    }

    const ext = runtime.extensions[0];
    return {
      installPath,
      installName,
      sourceKind: resolved.kind,
      extension: ext
        ? {
            id: ext.id,
            namespace: ext.namespace,
            displayName: ext.displayName,
            version: ext.version,
            sourcePath: ext.sourcePath,
          }
        : null,
      runtime,
      errorCount,
      warningCount,
      dependencyInstall,
    };
  } finally {
    resolved.cleanup?.();
  }
};

const installDependencies = (installPath: string, input: InstallExtensionInput): DependencyInstallReport => {
  const manifestPath = join(installPath, PACKAGE_MANIFEST);
  if (!existsSync(manifestPath)) return { ran: false, reason: "no_package_json" };
  if (input.skipInstall) return { ran: false, reason: "skipped" };

  const manager = input.packageManager ?? detectPackageManager(installPath).manager;

  if (!isPackageManagerOnPath(manager)) {
    throw new ExtensionInstallError(
      "package_manager_not_found",
      `Package manager "${manager}" is not on PATH.\n` +
        `Install it, pass --install=<other-manager>, or rerun with --no-install.`,
    );
  }

  const result = runPackageInstall({ extensionPath: installPath, manager });

  if (result.spawnError || result.status !== 0) {
    const reason = result.spawnError?.message ?? result.stderr.trim() ?? `${manager} install exited ${result.status}`;
    throw new ExtensionInstallError(
      "dependencies_install_failed",
      `Failed to install dependencies:\n  ${result.command}\n\n` +
        `Reason:\n  ${reason}\n\n` +
        `You can retry with:\n  cd ${installPath}\n  ${result.command}`,
    );
  }

  return { ran: true, manager, command: result.command };
};
