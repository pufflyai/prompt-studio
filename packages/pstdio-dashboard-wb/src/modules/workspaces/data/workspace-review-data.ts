import type { Diff } from "@pstdio/ui";

export interface DashboardWorkspaceFileDiff {
  filePath: string;
  change: Diff["change"];
  additions: number;
  deletions: number;
  oldContent?: string;
  newContent?: string;
  oldPath?: string;
  newPath?: string;
}

export interface DashboardWorkspaceDiffResponse {
  workspace_id: string;
  files: DashboardWorkspaceFileDiff[];
  totals: {
    additions: number;
    deletions: number;
    file_count: number;
  };
}

export interface DashboardWorkspaceArtifact {
  id: string;
  fileId: string;
  fileName: string;
  fileKind: string;
  relativePath: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardWorkspaceCheck {
  id: string;
  fileId: string;
  label: string;
  status: "failed" | "passed" | "saved";
  artifact: DashboardWorkspaceArtifact;
}

export interface DashboardWorkspaceReview {
  workspaceId: string;
  artifacts: DashboardWorkspaceArtifact[];
  checks: DashboardWorkspaceCheck[];
}

export const createEmptyDashboardWorkspaceReview = (workspaceId: string): DashboardWorkspaceReview => ({
  workspaceId,
  artifacts: [],
  checks: [],
});

export const collectWorkspaceChangedFilePaths = (files: DashboardWorkspaceFileDiff[]) =>
  files.map((file) => file.newPath ?? file.oldPath ?? file.filePath);

export const transformWorkspaceFileDiffs = (files: DashboardWorkspaceFileDiff[]): Diff[] =>
  files.map((file) => ({
    change: file.change,
    oldPath: file.oldPath ?? file.filePath,
    newPath: file.newPath ?? file.filePath,
    oldContent: file.oldContent,
    newContent: file.newContent,
    additions: file.additions,
    deletions: file.deletions,
  }));
