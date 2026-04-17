import { buildTicketContentRefreshKey } from "../../ticket/hooks/use-ticket-content-refresh-key";
import type { ApiWorkspaceArtifact } from "../../ticket-list/data/api/types";

export const buildWorkspaceChecksContentRequest = (
  artifacts: ApiWorkspaceArtifact[],
  selectedArtifactId: string | null,
) => {
  const selectedArtifact = artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0] ?? null;
  if (!selectedArtifact) {
    return { selectedArtifact: null, refreshKey: "" };
  }

  const metadataByFileId = new Map(
    artifacts.map((artifact) => [artifact.file_id, { updated_at: artifact.updated_at }]),
  );

  return {
    selectedArtifact,
    refreshKey: buildTicketContentRefreshKey({
      selectedFileId: selectedArtifact.file_id,
      fileMetadataById: metadataByFileId,
    }),
  };
};
