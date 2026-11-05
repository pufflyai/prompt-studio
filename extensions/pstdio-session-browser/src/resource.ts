import type { ExtensionSession, ResourceRef } from "@pstdio/sdk/extensions";
import { sessionBrowser } from "../refs";

export const sessionResource = (session: ExtensionSession, projectId: string): ResourceRef => ({
  type: "session",
  id: session.id,
  extensionId: "pstdio",
  projectId,
  label: session.title,
  icon: "message-circle",
  device: session.device,
  metadata: { status: session.status, ...(session.workspaceId ? { workspaceId: session.workspaceId } : {}) },
});
export const sessionTarget = (resource: ResourceRef) => ({
  kind: "page" as const,
  page: sessionBrowser.pages.session,
  resource,
});
export const draftResource = (
  projectId: string,
  input: { workspaceId?: string; harnessId?: string; deviceId?: string } = {},
): ResourceRef => ({
  type: "session-draft",
  id: `new-${crypto.randomUUID()}`,
  extensionId: "pstdio",
  projectId,
  label: "New session",
  icon: "message-circle",
  metadata: {
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    ...(input.harnessId ? { agent: input.harnessId } : {}),
  },
});
export const sessionId = (resource?: ResourceRef) => (resource?.type === "session" ? resource.id : undefined);
