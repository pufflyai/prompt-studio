import type { ResourceRef } from "@pstdio/workbench";

export const createDashboardExtensionPanelResource = (input: {
  extensionId: string;
  icon?: string;
  label: string;
  panelId: string;
  projectId: string;
}) =>
  ({
    kind: "extension-view",
    uri: `dashboard-workbench://project/${input.projectId}/extension-views/${input.panelId}`,
    id: input.panelId,
    label: input.label,
    icon: input.icon,
    metadata: {
      extensionId: input.extensionId,
      navigationModeId: "project",
      projectId: input.projectId,
      favoriteScope: { scope: "project", projectId: input.projectId },
    },
  }) satisfies ResourceRef;
