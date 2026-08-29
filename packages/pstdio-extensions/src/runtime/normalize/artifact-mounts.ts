import type { ArtifactMountContribution } from "@pstdio/sdk/extensions";
import { ARTIFACT_MOUNT_ROOT } from "../../artifacts/artifact-mount";
import { normalizeArtifactMountPath } from "../../artifacts/path-normalization";
import type { NormalizedExtension, RuntimeArtifactMount } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { isLocalizableString } from "./localizable";

export const registerArtifactMounts = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "artifact-mount",
    contributions: contributionArray<ArtifactMountContribution>(source.definition.artifactMounts),
  });
  for (const mount of contributions) {
    const localId = mount.id;
    if (!isRecord(mount) || typeof mount.path !== "string" || !isLocalizableString(mount.label)) continue;

    const relativePath = normalizeArtifactMountPath(mount.path);
    if (!relativePath) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "unsafe_artifact_mount_path",
          message: `Artifact mount "${ext.name}.${localId}" must stay under ${ARTIFACT_MOUNT_ROOT}/${ext.name}/`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }

    const fullPath = `${ARTIFACT_MOUNT_ROOT}/${ext.name}/${relativePath}`;
    const collisionKey = `${ext.name}:${relativePath}`;
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
      ...contributionRecordBase(ext, source, "artifact-mount", localId),
      relativePath,
      fullPath,
      label: mount.label,
      repoRole: typeof mount.repoRole === "string" ? (mount.repoRole as RuntimeArtifactMount["repoRole"]) : undefined,
    };
    index.mountKeys.set(collisionKey, record);
    runtime.artifactMounts.push(record);
  }
};
