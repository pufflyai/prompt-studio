import type { InstallationPreviewJob } from "./types";
export const isOverviewJob = (job: InstallationPreviewJob) =>
  job.extensionId !== "pstdio.pstdio-extension-installations" && job.installName !== "pstdio-extension-installations";

export const installationItems = (jobs: InstallationPreviewJob[]) => {
  const groups = new Map<string, InstallationPreviewJob[]>();
  for (const job of jobs) {
    if (!isOverviewJob(job)) continue;
    const key = JSON.stringify([job.projectId, job.installName]);
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  return [...groups.values()].map((group) => {
    group.sort((a, b) => b.queuedAt.localeCompare(a.queuedAt));
    return group.find((job) => job.status === "running") ?? group.find((job) => job.status === "queued") ?? group[0]!;
  });
};
