import { normalizeArtifactMountPath } from "../../artifacts/path-normalization";
import type { NormalizedExtension, RuntimeArtifactMount } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";

export const registerArtifactMounts = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, mount] of Object.entries(source.definition.artifactMounts ?? {})) {
    if (!isRecord(mount) || typeof mount.path !== "string" || typeof mount.label !== "string") continue;

    const relativePath = normalizeArtifactMountPath(mount.path);
    if (!relativePath) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "unsafe_artifact_mount_path",
          message: `Artifact mount "${ext.namespace}.${localId}" must stay under .pstdio/${ext.namespace}/`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }

    const fullPath = `.pstdio/${ext.namespace}/${relativePath}`;
    const collisionKey = `${ext.namespace}:${relativePath}`;
    const existing = index.mountKeys.get(collisionKey);
    if (existing) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_artifact_mount",
          message: `Artifact mount path "${fullPath}" is already provided`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }

    const record: RuntimeArtifactMount = {
      id: `${ext.namespace}.${localId}`,
      localId,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      relativePath,
      fullPath,
      label: mount.label,
      repoRole: typeof mount.repoRole === "string" ? (mount.repoRole as RuntimeArtifactMount["repoRole"]) : undefined,
    };
    index.mountKeys.set(collisionKey, record);
    runtime.artifactMounts.push(record);
  }
};
