import { AccountRequestError } from "../account/native-account";

interface Source {
  retry(): void | Promise<void>;
  restart(): Promise<void>;
}
export type ProjectSyncRetry = (
  projectId: string,
  sourceId?: string,
  requireCurrent?: () => Promise<void>,
) => Promise<{ settled: Promise<void> } | void>;

export const createProjectSyncRetry =
  (input: {
    refresh(): Promise<void>;
    owners: Record<string, { get(id: string): Source | undefined }>;
    folders: { get(id: string): Pick<Source, "retry"> | undefined };
    extensions: Map<string, Source & { owner: { workbenchId: string; extensionId: string } }>;
  }) =>
  async (projectId: string, sourceId?: string, requireCurrent?: () => Promise<void>) => {
    await input.refresh();
    await requireCurrent?.();
    if (sourceId !== undefined) {
      const builtIn = Object.hasOwn(input.owners, sourceId) ? input.owners[sourceId] : undefined;
      const owner = builtIn?.get(projectId) ?? input.extensions.get(JSON.stringify([projectId, sourceId]));
      if (!owner) throw new AccountRequestError("Unknown Cloud sync source");
      await owner.restart();
      return;
    }
    const retries = [
      ...Object.values(input.owners).map((owners) => owners.get(projectId)?.retry()),
      input.folders.get(projectId)?.retry(),
      ...[...input.extensions.values()]
        .filter((owner) => owner.owner.workbenchId === projectId)
        .map((owner) => owner.retry()),
    ];
    return { settled: Promise.allSettled(retries).then(() => {}) };
  };
