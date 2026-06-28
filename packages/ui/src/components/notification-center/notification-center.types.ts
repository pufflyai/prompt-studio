import type { ReactNode } from "react";

export type NotificationCenterPriority = "low" | "normal" | "high" | "urgent";

export type NotificationCenterStatus = "open" | "read" | "snoozed" | "done" | "dismissed" | "expired";

export interface NotificationCenterAction {
  id: string;
  label: string;
  primary?: boolean;
  destructive?: boolean;
}

export interface NotificationCenterItem {
  id: string;
  title: string;
  body?: string | null;
  kind?: string;
  priority: NotificationCenterPriority;
  status: NotificationCenterStatus;
  sourceLabel?: string | null;
  targetLabel?: string | null;
  timeLabel?: string | null;
  actions?: NotificationCenterAction[];
  searchText?: string;
}

export interface NotificationCenterProps {
  items: NotificationCenterItem[];
  loading?: boolean;
  error?: string | null;
  autoFocus?: boolean;
  emptyLabel?: string;
  query?: string;
  onQueryChange?: (query: string) => void;
  onActivateItem?: (item: NotificationCenterItem) => void;
  onRunAction?: (item: NotificationCenterItem, action: NotificationCenterAction) => void;
  onDismiss?: (item: NotificationCenterItem) => void;
  onEscape?: () => void;
  footerStart?: ReactNode;
  footerEnd?: ReactNode;
}
