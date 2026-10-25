import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createRegistryClient } from "pstdio-extensions/distribution";
import { findExtensionCatalogEntry, type GitExtensionOrigin, packagedExtensionCatalog } from "./extension-catalog";
import { type CommandOptions, type CommandResult, runCommand } from "./install-extension-dependencies";

// Extension sources come from https remotes, or from local repositories that a catalog file names.
// Every other transport is refused, including `ext::`, which runs commands.
export const extensionSourceGitConfig = [
  "-c",
  "protocol.allow=never",
  "-c",
  "protocol.https.allow=always",
  "-c",
  "protocol.file.allow=always",
];

export const isExtensionSourceUrl = (url: string) => url.startsWith("https://") || url.startsWith("file://");

// Fetching a ref instead of `clone --branch` lets the ref be a branch, a tag, or a full commit SHA.
const cloneRepoSparse = async (
  checkoutPath: string,
  paths: string[],
  run: (command: string, args: string[], options: CommandOptions) => Promise<CommandResult>,
  repositoryUrl: string,
  ref?: string,
  signal?: AbortSignal,
) => {
  const target = `${repositoryUrl}${ref ? ` at ${ref}` : ""}`;
  const git = async (args: string[], failure: string) => {
    signal?.throwIfAborted();
    const result = await run("git", args, { cwd: checkoutPath, ...(signal ? { signal } : {}) });
    signal?.throwIfAborted();
    if (result.exitCode !== 0) throw new Error(`${failure}: ${result.stderr.trim() || result.stdout.trim()}`);
    return result.stdout.trim();
  };

  mkdirSync(checkoutPath, { recursive: true });
  await git(["init"], `Failed to create a checkout for ${target}`);
  // `--` keeps a stored URL or ref that starts with `-` from being read as an option.
  await git(["remote", "add", "--", "origin", repositoryUrl], `Failed to add remote ${repositoryUrl}`);
  await git(["sparse-checkout", "set", ...paths], `Failed to fetch ${paths.join(", ")}`);
  await git(
    [...extensionSourceGitConfig, "fetch", "--depth", "1", "--filter=blob:none", "--", "origin", ref ?? "HEAD"],
    `Failed to fetch ${target}`,
  );
  // A partial clone downloads file contents during checkout, so checkout also needs the transport limits.
  await git([...extensionSourceGitConfig, "checkout", "FETCH_HEAD"], `Failed to check out ${target}`);
  return git(["rev-parse", "HEAD"], "Failed to resolve the installed commit");
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
  if (!explicitRef && hostReleaseRef?.startsWith("psx:") && entry.extensionId) {
    const registry = createRegistryClient(hostReleaseRef.slice(4));
    const release = await registry.latest(entry.extensionId, EXTENSION_API_VERSION, signal);
    return registry.prepare(release, join(tempDir, "extension-source"), signal);
  }
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
  if (!options.ref && options.hostReleaseRef?.startsWith("psx:")) {
    const prepared = new Map<string, ReturnType<typeof prepareNamedSource>>();
    return {
      cleanup,
      prepareNamedSource: (name: string, _tempDir: string, ref?: string, signal?: AbortSignal) => {
        let source = prepared.get(name);
        if (!source) {
          source = prepareNamedSource(name, join(tempDir, name), ref, signal, options.hostReleaseRef);
          prepared.set(name, source);
        }
        return source;
      },
    };
  }

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
