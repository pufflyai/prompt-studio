import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { resolvePstdioHome } from "pstdio-paths";
import type { ExtensionDiagnostic } from "../types/runtime";
import type { ExtensionApiProvider, PackageManifest } from "./package-manifest";
import { isPreparationHost, type PreparationOptions, runExtensionPreparation } from "./preparation-client";

// Bump when snapshotting, runtime bundling, or revision/webview formats change.
export const PREPARATION_FORMAT = 2;
export const preparationHostIdentity = () =>
  `${PREPARATION_FORMAT}:${EXTENSION_API_VERSION}:${Bun.version}:${process.platform}:${process.arch}`;
export const revisionDigest = (value: string) => createHash("sha256").update(value).digest("hex");
export const preparedCacheRoot = () => join(resolvePstdioHome(), "cache", "extension-revisions");
export const acceptedRevisionPath = (sourcePath: string) =>
  join(preparedCacheRoot(), "accepted", `${revisionDigest(resolve(sourcePath))}.json`);
export const preparedRevisionState = (revision: PreparedExtensionRevision | null) =>
  revision
    ? revisionDigest(
        JSON.stringify([revision.id, Object.entries(revision.webviews ?? {}).sort(([a], [b]) => a.localeCompare(b))]),
      )
    : null;
export interface PreparedExtensionRevision {
  id: string;
  host: string;
  packagePath: string;
  entryPath: string;
  sourceHash: string;
  loadKey: string;
  manifest: PackageManifest;
  diagnostics: ExtensionDiagnostic[];
  webviews?: Record<string, { id: string; distDir: string }>;
}

// This is deliberately the entire foreground cache check. Freshness is checked later in the
// worker; source hashing here would put the same scan back on the startup critical path.
export const readAcceptedRevision = async (sourcePath: string) => {
  try {
    const revision: PreparedExtensionRevision = JSON.parse(await readFile(acceptedRevisionPath(sourcePath), "utf8"));
    if (revision.host !== preparationHostIdentity()) return null;
    await Promise.all([
      access(revision.entryPath),
      access(join(revision.packagePath, "package.json")),
      ...Object.values(revision.webviews ?? {}).map((view) => access(join(view.distDir, "module.js"))),
    ]);
    return revision;
  } catch {
    return null;
  }
};
export const prepareExtensionRevision = async (
  sourcePath: string,
  options: PreparationOptions & { apiProvider?: ExtensionApiProvider } = {},
): Promise<PreparedExtensionRevision> => {
  if (!isPreparationHost) {
    const { prepareRevision } = await import("./prepare-revision");
    return prepareRevision(sourcePath, options.apiProvider);
  }
  return runExtensionPreparation("runtime.prepare", { sourcePath, apiProvider: options.apiProvider }, options);
};
export const acceptPreparedRevision = async (
  sourcePath: string,
  revision: PreparedExtensionRevision,
  options: PreparationOptions & { expectedId?: string | null; expectedState?: string | null } = {},
) => {
  if (!isPreparationHost) {
    const { acceptRevision } = await import("./prepare-revision");
    return acceptRevision(sourcePath, revision, options.expectedId, options.expectedState);
  }
  await runExtensionPreparation(
    "runtime.accept",
    { sourcePath, revision, expectedId: options.expectedId, expectedState: options.expectedState },
    { ...options, priority: "requested" },
  );
};
export const inspectExtensionLoadKey = async (sourcePath: string) => {
  if (!isPreparationHost) {
    const { inspectRevisionLoadKeyAsync } = await import("./prepare-revision");
    return inspectRevisionLoadKeyAsync(sourcePath);
  }
  return runExtensionPreparation<string>("runtime.key", { sourcePath });
};
