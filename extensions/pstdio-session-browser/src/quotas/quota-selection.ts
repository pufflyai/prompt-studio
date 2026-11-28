import type { QuotaReport } from "./quotas";

export const quotaSelection = (reports: QuotaReport[], selectedId?: string) => {
  const available = reports.filter((report) => report.status === "available" && report.limits.length > 0);
  return { available, selected: available.find((report) => report.id === selectedId) ?? available[0] };
};
