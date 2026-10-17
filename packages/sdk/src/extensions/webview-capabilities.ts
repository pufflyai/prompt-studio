import type { WebviewCapabilityDeclaration } from "pstdio-api-contracts/extension-kernel";
import { artifactMountId as hostArtifactMountId } from "pstdio-api-contracts/extension-kernel";

/** An artifact mount reference: the contribution, its ref, or the mount's local id. */
export type ArtifactMountKey = string | { id: string };

/** @deprecated Host-only. Hosts import `artifactMountId` from `pstdio-api-contracts`. */
export const artifactMountId = hostArtifactMountId;

/**
 * Declare webview read access to one artifact mount the extension defines.
 * Each mount is a separate grant; there is no wildcard.
 *
 * @example
 *   capabilities: ["commands.execute", artifactsRead(runArtifacts)]
 */
export const artifactsRead = (mount: ArtifactMountKey): WebviewCapabilityDeclaration =>
  `artifacts.read:${artifactMountId(mount)}`;
