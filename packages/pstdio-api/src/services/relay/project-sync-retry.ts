import { AccountRequestError } from "../account/native-account";

interface Source {
  retry(): void | Promise<void>;
  restart(): Promise<void>;
  prepareRetry(): () => void | Promise<void>;
  status(): { error?: string; needsAttention?: boolean } | Promise<{ error?: string; needsAttention?: boolean }>;
}
export type ProjectSyncRetry = (
  projectId: string,
  sourceId?: string | { failedOnly: true },
  requireCurrent?: () => Promise<void>,
) => Promise<{ settled: Promise<void> } | void>;

const retryFailedSources = async (
  owners: Pick<Source, "status" | "prepareRetry">[],
  requireCurrent?: () => Promise<void>,
) => {
  const attempts = await Promise.allSettled(
    owners.map(async (owner) => {
      const retry = owner.prepareRetry();
      return { retry, status: await owner.status() };
    }),
  );
  await requireCurrent?.();
  const retries: (void | Promise<void>)[] = [];
  for (const attempt of attempts) {
    if (attempt.status !== "fulfilled") continue;
    const { status, retry } = attempt.value;
    if (status.error || status.needsAttention) retries.push(retry());
  }
  return { settled: Promise.allSettled(retries).then(() => {}) };
};

export const createProjectSyncRetry =
  (input: {
    refresh(): Promise<void>;
    owners: Record<string, { get(id: string): Source | undefined }>;
    folders: { get(id: string): Pick<Source, "retry" | "status" | "prepareRetry"> | undefined };
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
      return retryFailedSources(owners, requireCurrent);
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
