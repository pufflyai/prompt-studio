export const reservedDashboardModeIds = new Set(["project-selection", "project", "workspace", "settings"]);

export const resolveModeId = (input: { extensionName: string; localId: string; id?: unknown }) =>
  typeof input.id === "string" && input.id.length > 0 ? input.id : `${input.extensionName}.${input.localId}`;
