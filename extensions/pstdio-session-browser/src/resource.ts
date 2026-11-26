import type { ExtensionSession, ResourceAnchor, ResourceRef } from "@pstdio/sdk/extensions";
import { sessionBrowser } from "../refs";
import { sessionDisplayStatus, sessionIndicator } from "./session-indicator";

export const sessionResource = (session: ExtensionSession, projectId: string) => {
  const indicator = sessionIndicator(sessionDisplayStatus(session));
  return {
    type: "session",
    id: session.id,
    extensionId: "pstdio",
    projectId,
    label: session.title,
    icon: indicator.icon,
    iconColor: indicator.color,
    iconLabel: indicator.label,
    device: session.device,
    metadata: { status: session.status, ...(session.workspaceId ? { workspaceId: session.workspaceId } : {}) },
  };
};
export const sessionTarget = (resource: ResourceRef) => ({
  kind: "page" as const,
  page: sessionBrowser.pages.session,
  resource,
});
export const draftResource = (
  projectId: string,
  input: { workspaceId?: string; harnessId?: string; deviceId?: string } = {},
) => ({
  type: "session-draft",
  id: `new-${crypto.randomUUID()}`,
  extensionId: "pstdio",
  projectId,
  label: "New session",
  icon: "circle-dashed",
  iconColor: "fg.muted",
  iconLabel: "Session status: pending",
  metadata: {
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    ...(input.harnessId ? { agent: input.harnessId } : {}),
  },
});
export const sessionId = (resource?: ResourceRef) => (resource?.type === "session" ? resource.id : undefined);

export const isProjectSessionResource = (resource: ResourceRef, projectId: string) =>
  resource.type === "session" &&
  (!resource.extensionId || resource.extensionId === "pstdio") &&
  (!resource.projectId || resource.projectId === projectId);

export const upgradeReviewAnchor = (
  projectId: string,
  resource: ResourceRef | undefined,
): ResourceAnchor[] | undefined => {
  const id = resource?.metadata?.upgradeReviewId;
  if (
    resource?.type === "session-draft" &&
    resource.extensionId === "pstdio" &&
    resource.projectId === projectId &&
    typeof id === "string" &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) &&
    resource.id.startsWith(`new-upgrade-${id}-`)
  )
    return [{ type: "extension-upgrade-review", id, extensionId: "pstdio", projectId, role: "context" }];
};
