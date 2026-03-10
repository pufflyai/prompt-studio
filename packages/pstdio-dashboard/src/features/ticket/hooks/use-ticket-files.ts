import { asSyncedRows, eq, getCollection, type SyncedRow, useLiveQuery } from "@/features/sync/collections";
import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import type { TicketFilePreview } from "@/features/ticket-list/types";

const toFilePreview = (row: SyncedRow): TicketFilePreview => ({
  id: row.id,
  file_name: row.file_name as string,
  file_kind: row.file_kind as string,
  mime_type: (row.mime_type as string) ?? null,
  size_bytes: row.size_bytes as number,
  created_at: row.created_at as string,
});

const toArtifact = (row: SyncedRow): ApiWorkspaceArtifact => ({
  id: row.id,
  file_id: row.file_id as string,
  file_name: row.file_name as string,
  file_kind: row.file_kind as string,
  relative_path: row.relative_path as string,
  mime_type: (row.mime_type as string) ?? null,
  size_bytes: row.size_bytes as number,
  created_at: row.created_at as string,
});

export const useTicketFiles = (ticketId: string | null | undefined) => {
  const { data: rawTicketFiles, isLoading } = useLiveQuery(
    (q) =>
      ticketId
        ? q
            .from({ tf: getCollection("ticket_files") })
            .where(({ tf }) => eq(tf.ticket_id, ticketId))
            .select(({ tf }) => ({ ...tf }))
        : undefined,
    [ticketId],
  );
  const ticketFiles = asSyncedRows(rawTicketFiles);

  const fileIds = new Set((ticketFiles ?? []).map((tf) => tf.file_id as string));

  const { data: rawFiles } = useLiveQuery((q) => q.from({ f: getCollection("files") }).select(({ f }) => ({ ...f })));
  const allFiles = asSyncedRows(rawFiles);

  const { data: rawArtifacts } = useLiveQuery((q) =>
    q.from({ a: getCollection("workspace_artifacts") }).select(({ a }) => ({ ...a })),
  );
  const allArtifacts = asSyncedRows(rawArtifacts);

  const files = (allFiles ?? []).filter((f) => fileIds.has(f.id)).map(toFilePreview);
  const artifacts = (allArtifacts ?? []).filter((a) => fileIds.has(a.file_id as string)).map(toArtifact);

  const data = ticketId ? { files, artifacts } : undefined;

  return { data, isLoading };
};
