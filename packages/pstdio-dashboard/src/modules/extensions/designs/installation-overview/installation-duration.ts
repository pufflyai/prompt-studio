import type { InstallationPreviewJob } from "./types";
export const installationDuration = (jobs: InstallationPreviewJob[], now = Date.now()) => {
  if (!jobs.length) return 0;
  const starts = jobs.map((job) => Date.parse(job.startedAt ?? job.queuedAt));
  const pending = jobs.some((job) => job.status === "queued" || job.status === "running");
  const end = pending
    ? now
    : Math.max(...jobs.map((job) => Date.parse(job.completedAt ?? job.startedAt ?? job.queuedAt)));
  return Math.max(0, end - Math.min(...starts));
};
export const formatDuration = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
