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
  kind: string;
  source: string | null;
  body: string;
  files: StoredReportFile[];
  draft: boolean;
  createdAt: string;
  updatedAt: string;
}
