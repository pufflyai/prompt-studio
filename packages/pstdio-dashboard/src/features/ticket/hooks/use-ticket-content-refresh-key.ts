interface BuildTicketContentRefreshKeyInput {
  selectedFileId: string;
  fileMetadataById: Map<string, { updated_at: string }>;
}

export const buildTicketContentRefreshKey = (input: BuildTicketContentRefreshKeyInput) => {
  const metadata = input.fileMetadataById.get(input.selectedFileId);
  return metadata ? `${input.selectedFileId}:${metadata.updated_at}` : input.selectedFileId;
};
