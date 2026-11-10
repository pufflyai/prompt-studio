import { rmSync } from "node:fs";
import { hashExtensionSource } from "../authoring/hash-extension-source";
import { discoverExtensionPackages } from "./discovery";
import type { ExtensionApiProvider } from "./package-manifest";
import { createPreparationHandler } from "./preparation-server";
import { acceptRevision, inspectRevisionInputs, prepareRevision } from "./prepare-revision";
import { maintainPreparedCache } from "./prepared-cache";
import { acceptedRevisionPath, type PreparedExtensionRevision } from "./prepared-revision";
import { publishAcceptedWebviews } from "./publish-accepted-webviews";
export const runtimePreparationTasks = {
  "runtime.publish-webviews": publishAcceptedWebviews,
  "runtime.maintain": () => maintainPreparedCache(),
  "runtime.prepare": (input: { sourcePath: string; apiProvider?: ExtensionApiProvider }) =>
    prepareRevision(input.sourcePath, input.apiProvider),
  "runtime.accept": (input: {
    sourcePath: string;
    revision: PreparedExtensionRevision;
    expectedId?: string | null;
    expectedState?: string | null;
  }) => acceptRevision(input.sourcePath, input.revision, input.expectedId, input.expectedState),
  "runtime.forget": (input: { sourcePath: string }) => rmSync(acceptedRevisionPath(input.sourcePath), { force: true }),
  "runtime.key": (input: { sourcePath: string }) => inspectRevisionInputs(input.sourcePath).loadKey,
  "source.hash": (input: { sourcePath: string }) => hashExtensionSource(input.sourcePath),
  "source.discover": (input: { root: string }) => discoverExtensionPackages(input.root),
};
export const handleRuntimePreparation = createPreparationHandler(runtimePreparationTasks);
