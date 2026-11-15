import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { canonicalExtensionId, extensionIdentityRenames } from "pstdio-api-contracts/extension-host";
import { extensionStorageDirectory, readPackageManifestMetadata } from "pstdio-extensions";
import { expandHomePath, resolvePstdioHome } from "pstdio-paths";
import { isLocalExtensionSource } from "./extension-install-paths";
import type { InstallExtensionSourceInput } from "./install-extension-source-types";

// Resolve existing ancestors too: a new target under a symlinked root must
// conflict with a peer reading its canonical path. Conservative case/Unicode
// folding also covers case-insensitive host filesystems.
const pathKey = (path: string) => `path:${path.replaceAll("\\", "/").normalize("NFD").toLowerCase()}`;
const resourcePaths = (path: string) => {
  const absolute = resolve(path);
  let parent = absolute;
  while (true) {
    try {
      const canonical = resolve(realpathSync(parent), relative(parent, absolute));
      return [pathKey(absolute), pathKey(canonical)];
    } catch {
      const next = dirname(parent);
      if (next === parent) return [pathKey(absolute)];
      parent = next;
    }
  }
};

const extensionInstallDestinationResources = (input: InstallExtensionSourceInput, identity?: string) => {
  const name = input.installName;
  // Unknown manifest-derived names and nonportable filesystem aliases retain
  // exclusive admission. No manifest is loaded on the API thread.
  if (!name || !/^[a-z0-9_](?:[a-z0-9._-]*[a-z0-9_-])?$/i.test(name)) return undefined;
  const names = new Set([name]);
  try {
    names.add(extensionStorageDirectory(name));
  } catch {
    /* A custom install name is not necessarily an extension ID. */
  }
  const rename =
    identity &&
    extensionIdentityRenames.find(({ to }) => `${to.publisher}.${to.name}` === canonicalExtensionId(identity));
  if (rename) {
    for (const owner of [rename.from, rename.to]) {
      names.add(owner.name);
      names.add(`${owner.publisher}.${owner.name}`);
    }
  }
  const roots = [join(resolvePstdioHome(input), "extensions")];
  if (input.repoPath) roots.push(join(input.repoPath, ".pstdio", "extensions"));
  // Scope can come from the manifest; reserve both possible destinations.
  return [...new Set(roots.flatMap((root) => [...names].flatMap((name) => resourcePaths(join(root, name)))))];
};

const localSourcePath = (input: InstallExtensionSourceInput) => {
  if (input.preparedSource) return input.preparedSource.path;
  if (!isLocalExtensionSource(input.source) || input.source.endsWith(".tgz")) return undefined;
  const home = input.homedir?.() ?? homedir();
  return input.source.startsWith("~\\") ? join(home, input.source.slice(2)) : expandHomePath(input.source, home);
};

export const extensionInstallSourceResources = (input: InstallExtensionSourceInput) => {
  const path = localSourcePath(input);
  return path ? resourcePaths(path) : undefined;
};

export const extensionInstallResources = (input: InstallExtensionSourceInput, identity?: string) => {
  const destinations = extensionInstallDestinationResources(input, identity);
  return destinations && [...new Set([...destinations, ...(extensionInstallSourceResources(input) ?? [])])];
};

// Only the worker reads metadata. Reserve every possible renamed destination,
// including folders another install may create after this inspection.
export const inspectExtensionInstallResources = (input: InstallExtensionSourceInput) => {
  const source = localSourcePath(input);
  if (!source) return {};
  const { manifest } = readPackageManifestMetadata(source);
  if (!manifest) return {};
  let name = input.installName;
  if (name === undefined) {
    if (input.preparedSource?.ref.endsWith(".tgz")) name = manifest.id;
    else name = input.preparedSource ? input.source : basename(source);
  }
  const writes = extensionInstallDestinationResources({ ...input, installName: name }, manifest.id);
  if (!writes) return {};
  const identity = canonicalExtensionId(manifest.id);
  const reads = resourcePaths(source);
  // Local directory dependencies can install into the source checkout itself.
  // Reserve it before preparation even if dependencies change after inspection.
  if (!input.skipInstall && !input.preparedSource) writes.push(...reads);
  return { identity, resources: [...new Set([...reads, ...writes])], reservation: { reads, writes } };
};
