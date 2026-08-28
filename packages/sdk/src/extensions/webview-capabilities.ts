import type { WebviewCapabilityDeclaration } from "pstdio-api-contracts/extension-kernel";

/** An artifact mount reference: the contribution, its ref, or the mount's local id. */
export type ArtifactMountKey = string | { id: string };

export const artifactMountId = (mount: ArtifactMountKey) => (typeof mount === "string" ? mount : mount.id);

/**
 * Declare webview read access to one artifact mount the extension defines.
 * Each mount is a separate grant; there is no wildcard.
 *
 * @example
 *   capabilities: ["commands.execute", artifactsRead(runArtifacts)]
 */
export const artifactsRead = (mount: ArtifactMountKey): WebviewCapabilityDeclaration =>
  `artifacts.read:${artifactMountId(mount)}`;
