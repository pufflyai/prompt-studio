import { realpathSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { discoverExtensionPackages } from "../discovery";
import { loadExtensionPackage, type loadExtensionSources } from "../loader";
import { extensionLoadKeyForHost } from "../preparation/source-inputs";
import { disposeExtensionPreparation } from "../preparation/supervisor";
import { createExtensionOwner, ExtensionOwnerError } from "./supervisor";

const owners = new Map<string, ReturnType<typeof createExtensionOwner>>();
const stopped = new Set<string>();
const canonical = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};
export const extensionOwnersEnabled = () => process.env.PSTDIO_EXTENSION_PROCESS_OWNERS === "1";

const assertRunning = (path: string) => {
  if (stopped.has(path))
    throw new ExtensionOwnerError(
      "extension_owner_stopped",
      "This extension owner is stopped. Restart it explicitly to run work.",
      "cancelled",
    );
};

// The rollout remains explicit until all callback, credential and native release gates pass.
// A failed owner never falls back to importing that source into the API process.
export const loadExtensionPackageForHost: typeof loadExtensionPackage = async (pkg, diagnostics, options = {}) => {
  if (!extensionOwnersEnabled()) return loadExtensionPackage(pkg, diagnostics, options);
  const path = canonical(pkg.path);
  assertRunning(path);
  const key = `${path}\0${await extensionLoadKeyForHost(path)}\0${options.apiProvider ?? "host"}`;
  assertRunning(path);
  let owner = owners.get(key);
  if (!owner) {
    if (owners.size >= 16)
      throw new ExtensionOwnerError(
        "extension_owner_capacity",
        "The extension owner rollout limit was reached. Restart the backend to release retained generations.",
      );
    owner = createExtensionOwner({
      path: resolve(pkg.path),
      sourceKind: pkg.sourceKind,
      apiProvider: options.apiProvider,
    });
    owners.set(key, owner);
  }
  const source = await owner.load();
  diagnostics.push(...owner.diagnostics);
  if (source?.definition.harnesses?.length) {
    // Native session sinks and approved credentials must retain their contract before this path rolls out.
    throw new ExtensionOwnerError(
      "extension_owner_surface_pending",
      "Harness owner support is gated on session callback and credential parity. Disable the internal owner rollout to use this harness.",
    );
  }
  if (!source) return null;
  return {
    ...source,
    packagePath: pkg.path,
    sourcePath: join(pkg.path, relative(source.packagePath, source.sourcePath)),
    sourceKind: pkg.sourceKind ?? "local_path",
  };
};

export const loadExtensionSourcesForHost: typeof loadExtensionSources = async (options = {}) => {
  const diagnostics: Parameters<typeof loadExtensionPackage>[1] = [];
  const sources: NonNullable<Awaited<ReturnType<typeof loadExtensionPackage>>>[] = [];
  const packages = [
    ...(options.extensionRoots ?? []).flatMap((root) =>
      discoverExtensionPackages(root.path).map((path) => ({ path, sourceKind: root.sourceKind })),
    ),
    ...(options.extensionPackages ?? []),
  ];
  for (const pkg of packages) {
    const source = await loadExtensionPackageForHost(pkg, diagnostics, { apiProvider: options.apiProvider });
    if (source) sources.push(source);
  }
  return { sources, diagnostics };
};

export const stopExtensionOwners = async (sourcePath: string) => {
  const path = canonical(sourcePath);
  stopped.add(path);
  await Promise.all([...owners].filter(([key]) => key.startsWith(`${path}\0`)).map(([, owner]) => owner.stop()));
};
export const restartExtensionOwners = async (sourcePath: string) => {
  const path = canonical(sourcePath);
  await Promise.all([...owners].filter(([key]) => key.startsWith(`${path}\0`)).map(([, owner]) => owner.restart()));
  stopped.delete(path);
};
export const disposeExtensionOwners = async () => {
  const closing = [...owners.values()];
  owners.clear();
  stopped.clear();
  await Promise.all(closing.map((owner) => owner.dispose()));
  await disposeExtensionPreparation();
};
