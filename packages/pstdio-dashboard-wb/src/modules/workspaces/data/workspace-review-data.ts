import type { Diff } from "@pstdio/ui";
import type { SyncedRow } from "@/lib/sync/collections";

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
  ticketId: string | null;
  artifacts: DashboardWorkspaceArtifact[];
  checks: DashboardWorkspaceCheck[];
}

interface DashboardWorkspaceReviewRows {
  ticketWorkspaces: SyncedRow[];
  files: SyncedRow[];
  workspaceArtifacts: SyncedRow[];
}

const stripArtifactPrefix = (relativePath: string) => relativePath.replace(/^artifacts\//, "");

const resolveArtifactStatus = (relativePath: string): DashboardWorkspaceCheck["status"] => {
  const lower = relativePath.toLowerCase();
  if (lower.includes("fail") || lower.includes("error")) return "failed";
  if (lower.includes("pass") || lower.includes("ok") || lower.includes("success")) return "passed";
  return "saved";
};

const toWorkspaceArtifact = (artifactRow: SyncedRow, fileRow: SyncedRow): DashboardWorkspaceArtifact => ({
  id: artifactRow.id,
  fileId: artifactRow.file_id as string,
  fileName: fileRow.file_name as string,
  fileKind: fileRow.file_kind as string,
  relativePath: artifactRow.relative_path as string,
  mimeType: (fileRow.mime_type as string | null) ?? null,
  sizeBytes: fileRow.size_bytes as number,
  createdAt: artifactRow.created_at as string,
  updatedAt: fileRow.updated_at as string,
});

const toWorkspaceCheck = (artifact: DashboardWorkspaceArtifact): DashboardWorkspaceCheck => ({
  id: artifact.id,
  fileId: artifact.fileId,
  label: stripArtifactPrefix(artifact.relativePath),
  status: resolveArtifactStatus(artifact.relativePath),
  artifact,
});

export const createEmptyDashboardWorkspaceReview = (
  workspaceId: string,
  ticketId: string | null = null,
): DashboardWorkspaceReview => ({
  workspaceId,
  ticketId,
  artifacts: [],
  checks: [],
});

export const buildDashboardWorkspaceReviewsFromRows = (rows: DashboardWorkspaceReviewRows) => {
  const ticketIdByWorkspaceId = new Map(
    rows.ticketWorkspaces.map((link) => [link.workspace_id as string, link.ticket_id as string]),
  );
  const workspaceIdsByTicketId = new Map<string, string[]>();

  for (const [workspaceId, ticketId] of ticketIdByWorkspaceId) {
    const workspaceIds = workspaceIdsByTicketId.get(ticketId) ?? [];
    workspaceIds.push(workspaceId);
    workspaceIdsByTicketId.set(ticketId, workspaceIds);
  }

  const fileById = new Map(rows.files.map((file) => [file.id, file]));
  const reviewByWorkspaceId = new Map<string, DashboardWorkspaceReview>();

  for (const [workspaceId, ticketId] of ticketIdByWorkspaceId) {
    reviewByWorkspaceId.set(workspaceId, createEmptyDashboardWorkspaceReview(workspaceId, ticketId));
  }

  for (const artifactRow of rows.workspaceArtifacts) {
    const fileRow = fileById.get(artifactRow.file_id as string);
    if (!fileRow) continue;

    const ticketId = artifactRow.ticket_id as string;
    const workspaceIds = workspaceIdsByTicketId.get(ticketId) ?? [];
    const artifact = toWorkspaceArtifact(artifactRow, fileRow);
    const check = toWorkspaceCheck(artifact);

    for (const workspaceId of workspaceIds) {
      const review = reviewByWorkspaceId.get(workspaceId) ?? createEmptyDashboardWorkspaceReview(workspaceId, ticketId);
      review.artifacts.push(artifact);
      review.checks.push(check);
      reviewByWorkspaceId.set(workspaceId, review);
    }
  }

  for (const review of reviewByWorkspaceId.values()) {
    review.artifacts.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    review.checks.sort((left, right) => left.label.localeCompare(right.label));
  }

  return reviewByWorkspaceId;
};

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
