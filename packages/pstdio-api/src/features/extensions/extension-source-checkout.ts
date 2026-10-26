import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createRegistryClient } from "pstdio-extensions/distribution";
import { findExtensionCatalogEntry, type GitExtensionOrigin, packagedExtensionCatalog } from "./extension-catalog";
import { type ExtensionRepositoryOptions, prepareExtensionRepository } from "./extension-repository";

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
  const commit = await prepareExtensionRepository(checkoutPath, [entry.origin.path], entry.origin.url, ref, { signal });
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
  const commit = await prepareExtensionRepository(checkoutPath, [origin.path], origin.url, releaseRef, { signal });
  return { path: join(checkoutPath, origin.path), ref: namedSourceRef(commit, origin) };
};

export const createSharedNamedSourceCheckout = async (
  names: string[],
  options: ExtensionRepositoryOptions & {
    hostReleaseRef?: string;
    ref?: string;
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
      const commit = await prepareExtensionRepository(
        checkoutPath,
        group.entries.map((entry) => entry.origin.path),
        group.url,
        group.ref,
        options,
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
