/** Synthetic presentation data for the deferred Installation Overview design. */
export interface InstallationPreviewJob {
  id: string;
  installName: string;
  extensionId?: string;
  displayName: string;
  icon?: string;
  projectId?: string;
  status: "queued" | "running" | "completed" | "failed";
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}
