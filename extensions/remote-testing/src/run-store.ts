import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { RunRecord } from "./runs";

export async function listRuns(store: ExtensionStorageApi) {
  const runs = (await store.records.list()).flatMap(({ recordId, value, deleted }) => {
    if (deleted || !value || typeof value !== "object" || Array.isArray(value) || typeof value.runId !== "string")
      return [];
    if (recordId !== store.records.id(`run:${value.runId}`)) return [];
    return [value as unknown as RunRecord];
  });
  return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 50);
}

export class UnknownRunError extends Error {
  override name = "UnknownRunError";

  constructor(runId: string) {
    super(`Unknown run ${runId}. List runs with: pst pocketcoder.remote-testing runs list`);
  }
}

export async function readRun(store: ExtensionStorageApi, runId: string) {
  const record = await store.get<RunRecord>(`run:${runId}`);
  if (!record) throw new UnknownRunError(runId);
  return record;
}
