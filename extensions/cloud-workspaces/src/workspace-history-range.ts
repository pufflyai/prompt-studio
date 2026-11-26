import { l10n } from "@pstdio/sdk/extensions";
export const historyRanges = [
  { value: "hour", label: "Last hour", localizedLabel: l10n("cloud-workspaces.last-hour", "Last hour") },
  { value: "day", label: "Last 24 hours", localizedLabel: l10n("cloud-workspaces.last-24-hours", "Last 24 hours") },
  { value: "week", label: "Last 7 days", localizedLabel: l10n("cloud-workspaces.last-7-days", "Last 7 days") },
] as const;

export const defaultHistoryRange = "day";

export const workspaceHistoryCommandId = "deployed.workspace-history";
