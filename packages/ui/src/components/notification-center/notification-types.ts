export type NotificationKind = "needs_review" | "ready_to_merge" | "blocked" | "approval_required" | "failed" | "info";

export type NotificationStatus = "open" | "read" | "snoozed" | "done" | "dismissed" | "expired";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface NotificationActionItem {
  id: string;
  label: string;
  primary?: boolean;
  destructive?: boolean;
  kind: "open-resource" | "command" | "url";
}

export interface NotificationItem {
  id: string;
  title: string;
  body?: string | null;
  kind: NotificationKind;
  status: NotificationStatus;
  priority: NotificationPriority;
  sourceLabel?: string | null;
  resourceLabel?: string | null;
  updatedAt: string;
  snoozedUntil?: string | null;
  actions: NotificationActionItem[];
}

export const KIND_LABELS: Record<NotificationKind, string> = {
  needs_review: "Needs review",
  ready_to_merge: "Ready to merge",
  blocked: "Blocked",
  approval_required: "Approval required",
  failed: "Failed",
  info: "Info",
};

export const KIND_ICON_NAMES: Record<NotificationKind, string> = {
  needs_review: "Eye",
  ready_to_merge: "GitMerge",
  blocked: "AlertTriangle",
  approval_required: "ShieldCheck",
  failed: "XCircle",
  info: "Info",
};
