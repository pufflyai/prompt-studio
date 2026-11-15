import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { withFileMutationLock } from "pstdio-paths";
import { hashExtensionSource } from "../authoring/hash-extension-source";
import { bundleEntry } from "./bundle-entry";
import { type ExtensionApiProvider, readPackageManifest } from "./package-manifest";
import { retainPreparedRevision } from "./prepared-cache";
import {
  acceptedRevisionPath,
  type PreparedExtensionRevision,
  preparationHostIdentity,
  preparedCacheRoot,
  preparedRevisionState,
  revisionDigest,
} from "./prepared-revision";
import { copyRevisionCompilerInputs } from "./revision-compiler-inputs";
import {
  collectRevisionDependencies,
  copyRevisionDependencies,
  copyRevisionSource,
  hashRevisionDependencies,
  hashRevisionDependenciesAsync,
  hashRevisionSource,
} from "./revision-dependencies";
import { revisionSnapshotPath } from "./revision-snapshot-path";

const readRevisionInputs = (sourcePath: string, apiProvider?: ExtensionApiProvider) => {
  const read = readPackageManifest(sourcePath, { apiProvider });
  if (!read.manifest || !read.entryPath)
    throw Object.assign(new Error(read.diagnostics.map((d) => d.message).join("; ")), {
      diagnostics: read.diagnostics,
    });
  const dependencies = collectRevisionDependencies(sourcePath);
  return { ...read, manifest: read.manifest, entryPath: read.entryPath, dependencies };
};
const identifyRevisionInputs = (
  sourcePath: string,
  read: ReturnType<typeof readRevisionInputs>,
  dependencyHash: string,
) => {
  const sourceHash = hashExtensionSource(sourcePath);
  const id = revisionDigest(`${hashRevisionSource(sourcePath)}:${dependencyHash}:${preparationHostIdentity()}`);
  // Every input that can change the accepted runtime also changes its live load identity.
  const loadKey = id;
  return { ...read, sourceHash, loadKey, id };
};
export const inspectRevisionInputs = (sourcePath: string, apiProvider?: ExtensionApiProvider) => {
  const read = readRevisionInputs(sourcePath, apiProvider);
  return identifyRevisionInputs(sourcePath, read, hashRevisionDependencies(read.dependencies, sourcePath));
};
export const inspectRevisionInputsAsync = async (sourcePath: string, apiProvider?: ExtensionApiProvider) => {
  const read = readRevisionInputs(sourcePath, apiProvider);
  return identifyRevisionInputs(sourcePath, read, await hashRevisionDependenciesAsync(read.dependencies, sourcePath));
};
// Discovery must reach the loader's diagnostics for an invalid manifest. Handle local
// inspection errors here; transport failures still reject callers in the worker client.
export const inspectRevisionLoadKeyAsync = async (sourcePath: string) => {
  try {
    return (await inspectRevisionInputsAsync(sourcePath)).loadKey;
  } catch (error) {
    return `manifest-${JSON.stringify(error instanceof Error ? error.message : error)}`;
  }
};
export const prepareRevision = async (
  sourcePath: string,
  apiProvider?: ExtensionApiProvider,
): Promise<PreparedExtensionRevision> => {
  const inputs = await inspectRevisionInputsAsync(sourcePath, apiProvider);
  // The source identity is excluded: a staged install and its promoted folder must reuse
  // the very same artifacts rather than building again at the final path.
  const root = join(preparedCacheRoot(), "revisions", inputs.id);
  const descriptorPath = join(root, "revision.json");
  try {
    const cached: PreparedExtensionRevision = JSON.parse(readFileSync(descriptorPath, "utf8"));
    if (cached.host === preparationHostIdentity() && existsSync(cached.entryPath)) {
      retainPreparedRevision(cached);
      return cached;
    }
  } catch {}
  // Unique immutable paths also keep Bun's resolver from retaining a replaced package's exports.
  // Partial directories are never described or accepted and can be removed by cache maintenance.
  const generationRoot = join(root, crypto.randomUUID());
  const packagePath = revisionSnapshotPath(generationRoot, realpathSync(sourcePath));
  try {
    copyRevisionSource(sourcePath, packagePath);
    copyRevisionDependencies(inputs.dependencies, sourcePath, packagePath, generationRoot);
    copyRevisionCompilerInputs(inputs.dependencies.compilerInputs, generationRoot);
    const entryPath = await bundleEntry(
      join(packagePath, relative(sourcePath, inputs.entryPath)),
      packagePath,
      packagePath,
      generationRoot,
    );
    const after = await inspectRevisionInputsAsync(sourcePath, apiProvider);
    if (after.id !== inputs.id) throw new Error("Extension changed while preparing its revision.");
    const revision: PreparedExtensionRevision = {
      id: inputs.id,
      host: preparationHostIdentity(),
      packagePath,
      entryPath,
      sourceHash: inputs.sourceHash,
      loadKey: inputs.loadKey,
      manifest: inputs.manifest,
      diagnostics: inputs.diagnostics,
    };
    const staging = `${descriptorPath}.${crypto.randomUUID()}.tmp`;
    writeFileSync(staging, JSON.stringify(revision));
    renameSync(staging, descriptorPath);
    retainPreparedRevision(revision);
    return revision;
  } catch (error) {
    rmSync(generationRoot, { recursive: true, force: true });
    throw error;
  }
};
const completesSameRevision = (current: PreparedExtensionRevision | null, incoming: PreparedExtensionRevision) =>
  current?.id === incoming.id &&
  Object.entries(current.webviews ?? {}).every(
    ([id, view]) => incoming.webviews?.[id]?.id === view.id && incoming.webviews[id]?.distDir === view.distDir,
  );

export const acceptRevision = (
  sourcePath: string,
  revision: PreparedExtensionRevision,
  expectedId?: string | null,
  expectedState?: string | null,
) => {
  if (revision.host !== preparationHostIdentity() || !existsSync(revision.entryPath))
    throw new Error("Prepared extension revision is unavailable or incompatible.");
  const path = acceptedRevisionPath(sourcePath);
  mkdirSync(dirname(path), { recursive: true });
  return withFileMutationLock(path, () => {
    let current: PreparedExtensionRevision | null = null;
    try {
      current = JSON.parse(readFileSync(path, "utf8"));
    } catch {}
    if (
      expectedState !== undefined &&
      preparedRevisionState(current) !== expectedState &&
      preparedRevisionState(current) !== preparedRevisionState(revision) &&
      !completesSameRevision(current, revision)
    )
      throw new Error("Accepted extension revision changed before activation.");
    if (expectedId !== undefined && (current?.id ?? null) !== expectedId && current?.id !== revision.id)
      throw new Error("Accepted extension revision changed before activation.");
    const temporary = `${path}.${crypto.randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify(revision));
    renameSync(temporary, path);
  });
};
