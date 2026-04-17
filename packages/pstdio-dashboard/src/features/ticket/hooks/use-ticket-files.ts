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

const toArtifact = (artifactRow: SyncedRow, fileRow: SyncedRow): ApiWorkspaceArtifact => ({
  id: artifactRow.id,
  file_id: artifactRow.file_id as string,
  file_name: fileRow.file_name as string,
  file_kind: fileRow.file_kind as string,
  relative_path: artifactRow.relative_path as string,
  mime_type: (fileRow.mime_type as string) ?? null,
  size_bytes: fileRow.size_bytes as number,
  created_at: artifactRow.created_at as string,
  updated_at: fileRow.updated_at as string,
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
  const fileById = new Map((allFiles ?? []).map((file) => [file.id, file]));

  const { data: rawArtifacts } = useLiveQuery(
    (q) =>
      ticketId
        ? q
            .from({ a: getCollection("workspace_artifacts") })
            .where(({ a }) => eq(a.ticket_id, ticketId))
            .select(({ a }) => ({ ...a }))
        : undefined,
    [ticketId],
  );
  const allArtifacts = asSyncedRows(rawArtifacts);

  const files = (allFiles ?? []).filter((f) => fileIds.has(f.id)).map(toFilePreview);
  const artifacts = (allArtifacts ?? [])
    .map((artifact) => {
      const linkedFile = fileById.get(artifact.file_id as string);
      if (!linkedFile) return null;
      return toArtifact(artifact, linkedFile);
    })
    .filter((artifact): artifact is ApiWorkspaceArtifact => artifact !== null)
    .sort((a, b) => a.relative_path.localeCompare(b.relative_path));

  const data = ticketId ? { files, artifacts } : undefined;

  return { data, isLoading };
};
