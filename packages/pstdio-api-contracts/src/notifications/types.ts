import type { CommandSource } from "../extension-kernel/types/commands";
import type { JsonObject } from "../extension-kernel/types/json";
import type { ResourceRef } from "../extension-kernel/types/resources";

export type NotificationKind = "needs_review" | "ready_to_merge" | "blocked" | "approval_required" | "failed" | "info";

export type NotificationStatus = "open" | "read" | "snoozed" | "done" | "dismissed" | "expired";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationActorType = "user" | "agent" | "system";

export type NotificationOrigin = "core" | "extension" | "agent";

export type NotificationAction =
  | {
      id: string;
      label: string;
      kind: "open-resource";
      resource: ResourceRef;
      primary?: boolean;
    }
  | {
      id: string;
      label: string;
      kind: "command";
      command: string;
      params?: JsonObject;
      primary?: boolean;
      destructive?: boolean;
    }
  | {
      id: string;
      label: string;
      kind: "url";
      href: string;
      primary?: boolean;
    };

export type NotificationActionResult =
  | { kind: "open-resource"; resource: ResourceRef }
  | { kind: "command"; commandId: string; outcome: JsonObject }
  | { kind: "url"; href: string };

export interface Notification {
  id: string;
  projectId: string;
  title: string;
  body?: string | null;
  kind: NotificationKind;
  status: NotificationStatus;
  priority: NotificationPriority;
  source: CommandSource;
  origin: NotificationOrigin;
  sourceExtensionId?: string | null;
  actorType?: NotificationActorType | null;
  actorId?: string | null;
  target?: ResourceRef | null;
  related: ResourceRef[];
  actions: NotificationAction[];
  dedupeKey?: string | null;
  metadata?: JsonObject | null;
  createdAt: string;
  updatedAt: string;
  readAt?: string | null;
  resolvedAt?: string | null;
  snoozedUntil?: string | null;
  expiresAt?: string | null;
}

export interface CreateNotificationInput {
  projectId: string;
  title: string;
  body?: string;
  kind: NotificationKind;
  priority?: NotificationPriority;
  target?: ResourceRef;
  related?: ResourceRef[];
  actions?: NotificationAction[];
  dedupeKey?: string;
  expiresAt?: string;
  snoozedUntil?: string;
  metadata?: JsonObject;
}

export interface UpdateNotificationInput {
  priority?: NotificationPriority;
  snoozedUntil?: string | null;
  metadata?: JsonObject;
}

export interface ListNotificationsQuery {
  status?: NotificationStatus | NotificationStatus[];
  priority?: NotificationPriority | NotificationPriority[];
  sourceExtensionId?: string;
  resourceType?: string;
  resourceId?: string;
  cursor?: string;
  limit?: number;
}

export interface ListNotificationsResponse {
  items: Notification[];
  nextCursor?: string | null;
}
