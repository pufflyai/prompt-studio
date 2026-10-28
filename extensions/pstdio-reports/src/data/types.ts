export interface StoredReportFile {
  id: string;
  name: string;
  blobId: string;
  mimeType: string | null;
  size: number;
  hash: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredReport {
  id: string;
  workspaceShorthand: string;
  workspaceId: string | null;
  name: string;
  directoryName?: string;
  kind: string;
  source: string | null;
  /** Blob in the report attachments that holds the markdown body. */
  bodyBlobId: string;
  files: StoredReportFile[];
  draft: boolean;
  createdAt: string;
  updatedAt: string;
}
