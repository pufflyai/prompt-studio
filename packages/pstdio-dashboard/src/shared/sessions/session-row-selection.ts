import type { SyncedRow } from "@/features/sync/collections";

interface FindSessionRowInput {
  sessionId: string | null | undefined;
  projectId?: string | null | undefined;
}

export const findSessionRow = (rows: SyncedRow[] | undefined, input: FindSessionRowInput) => {
  const { sessionId, projectId } = input;
  if (!sessionId) return undefined;

  return rows?.find((row) => {
    if (row.id !== sessionId) return false;
    if (!projectId) return true;
    return row.project_id === projectId;
  });
};
