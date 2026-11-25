import { type ExtensionConnectionServiceDeps, toConnectionRecord } from "./extension-connection-service-types";

export const createExtensionConnectionListService = (deps: ExtensionConnectionServiceDeps) => ({
  async list(projectId: string) {
    const rows = [
      ...(await deps.connectionsDBService.listByProject(projectId)),
      ...(await deps.connectionsDBService.listGlobal()),
    ];
    const visible = await Promise.all(
      rows.map(async (row) => {
        const definition = await deps.getContribution({
          projectId,
          extensionId: row.extension_id,
          connectionId: row.contribution_id,
        });
        if (!definition || (definition.scope === "global") !== (row.project_id === null)) return null;
        return toConnectionRecord(row);
      }),
    );
    return visible.filter((row) => row !== null);
  },
  listSavedSignIns: deps.connectionsDBService.listSavedSignIns,
});
