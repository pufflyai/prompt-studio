import { AccountRequestError } from "../account/native-account";

interface Source {
  retry(): void;
  restart(): Promise<void>;
}
export const createProjectSyncRetry =
  (input: {
    refresh(): Promise<void>;
    owners: Record<string, { get(id: string): Source | undefined }>;
    folders: { get(id: string): { retry(): void } | undefined };
    extensions: Map<string, Source & { owner: { workbenchId: string; extensionId: string } }>;
  }) =>
  async (projectId: string, sourceId?: string) => {
    await input.refresh();
    if (sourceId) {
      const builtIn = Object.hasOwn(input.owners, sourceId) ? input.owners[sourceId] : undefined;
      const owner = builtIn?.get(projectId) ?? input.extensions.get(JSON.stringify([projectId, sourceId]));
      if (!owner) throw new AccountRequestError("Unknown Cloud sync source");
      await owner.restart();
      return;
    }
    for (const owners of Object.values(input.owners)) owners.get(projectId)?.retry();
    input.folders.get(projectId)?.retry();
    for (const owner of input.extensions.values()) if (owner.owner.workbenchId === projectId) owner.retry();
  };
