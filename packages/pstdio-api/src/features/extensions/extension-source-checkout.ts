import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { findExtensionCatalogEntry, type GitExtensionOrigin, packagedExtensionCatalog } from "./extension-catalog";
import { type CommandOptions, type CommandResult, runCommand } from "./install-extension-dependencies";

const cloneRepoSparse = async (
  checkoutPath: string,
  paths: string[],
  run: (command: string, args: string[], options: CommandOptions) => Promise<CommandResult>,
  repositoryUrl: string,
  ref?: string,
  signal?: AbortSignal,
) => {
  const tempParent = dirname(checkoutPath);
  const cloneArgs = ["clone", "--depth", "1", "--filter=blob:none", "--sparse"];
  if (ref) cloneArgs.push("--branch", ref);
  signal?.throwIfAborted();
  const clone = await run("git", [...cloneArgs, repositoryUrl, checkoutPath], {
    cwd: tempParent,
    ...(signal ? { signal } : {}),
  });
  if (clone.exitCode !== 0) {
    const detail = clone.stderr.trim() || clone.stdout.trim();
    throw new Error(`Failed to clone ${repositoryUrl}${ref ? ` at ${ref}` : ""}: ${detail}`);
  }

  signal?.throwIfAborted();
  const sparse = await run("git", ["sparse-checkout", "set", ...paths], {
    cwd: checkoutPath,
    ...(signal ? { signal } : {}),
  });
  if (sparse.exitCode !== 0) {
    throw new Error(`Failed to fetch ${paths.join(", ")}: ${sparse.stderr.trim() || sparse.stdout.trim()}`);
  }

  signal?.throwIfAborted();
  const head = await run("git", ["rev-parse", "HEAD"], {
    cwd: checkoutPath,
    ...(signal ? { signal } : {}),
  });
  signal?.throwIfAborted();
  if (head.exitCode !== 0) {
    throw new Error(`Failed to resolve the installed commit: ${head.stderr.trim() || head.stdout.trim()}`);
  }

  return head.stdout.trim();
};

const packagedEntry = (installName: string) =>
  packagedExtensionCatalog.extensions.find((entry) => entry.installName === installName);

export const namedSourceRef = (commit: string, source: GitExtensionOrigin | string) => {
  const origin = typeof source === "string" ? packagedEntry(source)?.origin : source;
  if (!origin) throw new Error(`No catalog entry for extension: ${source}`);
  return `${origin.url}@${commit}#${origin.path}`;
};

const originRef = (origin: GitExtensionOrigin, explicitRef?: string, hostReleaseRef?: string) => {
  if (explicitRef) return explicitRef;
  if (origin.ref !== "{hostRelease}") return origin.ref;
  if (hostReleaseRef) return hostReleaseRef;
  throw new Error(`Catalog origin ${origin.url}#${origin.path} requires a host release ref`);
};

export const prepareNamedSource = async (
  name: string,
  tempDir: string,
  explicitRef?: string,
  signal?: AbortSignal,
  hostReleaseRef?: string,
) => {
  const entry = await findExtensionCatalogEntry(name);
  if (!entry) throw new Error(`No catalog entry for extension: ${name}`);
  const ref = originRef(entry.origin, explicitRef, hostReleaseRef);
  const checkoutPath = join(tempDir, "extension-source");
  const commit = await cloneRepoSparse(checkoutPath, [entry.origin.path], runCommand, entry.origin.url, ref, signal);
  return {
    path: join(checkoutPath, entry.origin.path),
    ref: namedSourceRef(commit, entry.origin),
  };
};

export const prepareGitExtensionSource = async (
  origin: GitExtensionOrigin,
  tempDir: string,
  releaseRef: string,
  signal?: AbortSignal,
) => {
  const checkoutPath = join(tempDir, "extension-source");
  const commit = await cloneRepoSparse(checkoutPath, [origin.path], runCommand, origin.url, releaseRef, signal);
  return { path: join(checkoutPath, origin.path), ref: namedSourceRef(commit, origin) };
};

export const createSharedNamedSourceCheckout = async (
  names: string[],
  options: {
    hostReleaseRef?: string;
    ref?: string;
    runCommand?: (command: string, args: string[], opts: CommandOptions) => Promise<CommandResult>;
    signal?: AbortSignal;
  } = {},
) => {
  const tempDir = mkdtempSync(join(tmpdir(), "pstdio-extension-shared-"));
  const cleanup = () => rmSync(tempDir, { recursive: true, force: true });

  if (names.length === 0) return { prepareNamedSource, cleanup };

  const entries = await Promise.all(
    names.map(async (name) => {
      const entry = await findExtensionCatalogEntry(name);
      if (!entry) throw new Error(`No catalog entry for extension: ${name}`);
      return entry;
    }),
  );
  const groups = new Map<string, { entries: typeof entries; ref: string; url: string }>();
  for (const entry of entries) {
    const ref = originRef(entry.origin, options.ref, options.hostReleaseRef);
    const key = `${entry.origin.url}\0${ref}`;
    const group = groups.get(key) ?? { entries: [], ref, url: entry.origin.url };
    group.entries.push(entry);
    groups.set(key, group);
  }

  const preparedByName = new Map<string, { path: string; ref: string }>();
  try {
    let index = 0;
    for (const group of groups.values()) {
      const checkoutPath = join(tempDir, `extension-source-${index}`);
      index += 1;
      const commit = await cloneRepoSparse(
        checkoutPath,
        group.entries.map((entry) => entry.origin.path),
        options.runCommand ?? runCommand,
        group.url,
        group.ref,
        options.signal,
      );
      for (const entry of group.entries) {
        preparedByName.set(entry.installName, {
          path: join(checkoutPath, entry.origin.path),
          ref: namedSourceRef(commit, entry.origin),
        });
      }
    }
  } catch (error) {
    cleanup();
    throw error;
  }

  const shared = async (name: string, _tempDir?: string, _ref?: string, signal?: AbortSignal) => {
    signal?.throwIfAborted();
    const prepared = preparedByName.get(name);
    if (!prepared) throw new Error(`No prepared checkout for extension: ${name}`);
    return prepared;
  };

  return { prepareNamedSource: shared, cleanup };
};
