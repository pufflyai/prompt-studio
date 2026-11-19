import type { ResourceRef } from "pstdio-api-contracts/extension-kernel";
import { canonicalResource } from "../extensions/command-environment/resource-link-policy";
import type { ExtensionsRouteDeps } from "../extensions/deps";

/** Device hints route authorized history; they never grant access to a colliding local ID. */
export const admitChangeResource = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  raw: ResourceRef,
  extensionId: string,
  signal?: AbortSignal,
) => {
  if (raw.projectId && raw.projectId !== projectId) throw new Error("Resource belongs to another project.");
  if (raw.device && (raw.type !== "session" || extensionId !== "pstdio"))
    throw new Error("Resource device is unavailable.");
  const ref = await canonicalResource(deps, { projectId, signal }, { ...raw, projectId, extensionId });
  if (extensionId !== "pstdio") return ref;
  if (ref.device || raw.device) {
    const authorized = await deps.personalHistoryService.getSession(ref.id, projectId);
    const requested = raw.device ?? ref.device;
    if (!authorized || authorized.device.id !== requested?.id || authorized.device.ownerId !== requested?.ownerId)
      throw new Error("Resource device is unavailable.");
    return { ...ref, device: authorized.device };
  }
  const local = await deps.sessionService.get(ref.id);
  if (local?.project_id === projectId) return ref;
  const remote = await deps.personalHistoryService.getSession(ref.id, projectId);
  return remote ? { ...ref, device: remote.device } : undefined;
};
