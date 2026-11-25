import { AccountRequestError } from "../account/native-account";

interface Source {
  retry(): void | Promise<void>;
  restart(): Promise<void>;
  status(): { error?: string; needsAttention?: boolean } | Promise<{ error?: string; needsAttention?: boolean }>;
}
export type ProjectSyncRetry = (
  projectId: string,
  sourceId?: string | { failedOnly: true },
  requireCurrent?: () => Promise<void>,
) => Promise<{ settled: Promise<void> } | void>;

export const createProjectSyncRetry =
  (input: {
    refresh(): Promise<void>;
    owners: Record<string, { get(id: string): Source | undefined }>;
    folders: { get(id: string): Pick<Source, "retry" | "status"> | undefined };
    extensions: Map<string, Source & { owner: { workbenchId: string; extensionId: string } }>;
  }) =>
  async (projectId: string, sourceId?: string | { failedOnly: true }, requireCurrent?: () => Promise<void>) => {
    await input.refresh();
    await requireCurrent?.();
    if (typeof sourceId === "string") {
      const builtIn = Object.hasOwn(input.owners, sourceId) ? input.owners[sourceId] : undefined;
      const owner = builtIn?.get(projectId) ?? input.extensions.get(JSON.stringify([projectId, sourceId]));
      if (!owner) throw new AccountRequestError("Unknown Cloud sync source");
      await owner.restart();
      return;
    }
    if (sourceId) {
      const owners = [
        ...Object.values(input.owners).map((owners) => owners.get(projectId)),
        input.folders.get(projectId),
        ...[...input.extensions.values()].filter((owner) => owner.owner.workbenchId === projectId),
      ].filter((owner) => owner !== undefined);
      const statuses = await Promise.all(owners.map((owner) => owner.status()));
      await requireCurrent?.();
      // Download repairs current failures without replacing another owner's healthy pass.
      const retries = owners
        .filter((_owner, index) => statuses[index]?.error || statuses[index]?.needsAttention)
        .map((owner) => owner.retry());
      return { settled: Promise.allSettled(retries).then(() => {}) };
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
