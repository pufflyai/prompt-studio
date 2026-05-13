import {
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../contributions/metadata";
import { createDisposable } from "../disposable";
import type { ResourceRef } from "../resources/resource-registry";

export type ShellNotificationLevel = "info" | "success" | "warning" | "error";

export interface ShellNotificationAction {
  commandId: string;
  title: string;
  args?: unknown;
}

export interface ShellNotification {
  id?: string;
  level: ShellNotificationLevel;
  title: string;
  message?: string;
  createdAt?: string;
  resource?: ResourceRef;
  actions?: ShellNotificationAction[];
  metadata?: Record<string, unknown>;
}

export interface RegisteredShellNotification extends RegisteredContributionMetadata {
  id: string;
  level: ShellNotificationLevel;
  title: string;
  message?: string;
  createdAt: string;
  resource?: ResourceRef;
  actions?: ShellNotificationAction[];
  metadata?: Record<string, unknown>;
}

export type ShellNotificationEvent =
  | { type: "show"; id: string; notification: RegisteredShellNotification }
  | { type: "dismiss"; id: string };

type ShellNotificationListener = (event: ShellNotificationEvent) => void;

export const createNotificationRegistry = () => {
  const notifications = new Map<string, RegisteredShellNotification>();
  const listeners = new Set<ShellNotificationListener>();
  let generatedId = 0;

  const emit = (event: ShellNotificationEvent) => {
    for (const listener of listeners) listener(event);
  };

  return {
    show(notification: ShellNotification, metadata?: ContributionMetadata) {
      let id = notification.id;
      if (!id) {
        generatedId += 1;
        id = `shell.notification.${generatedId.toString()}`;
      }

      const record = {
        ...normalizeContributionMetadata(metadata),
        ...notification,
        id,
        createdAt: notification.createdAt ?? new Date().toISOString(),
      };

      notifications.set(id, record);
      emit({ type: "show", id, notification: record });

      return record;
    },

    dismiss(id: string) {
      const deleted = notifications.delete(id);
      if (deleted) emit({ type: "dismiss", id });
      return deleted;
    },

    clear() {
      const ids = [...notifications.keys()];
      notifications.clear();
      for (const id of ids) emit({ type: "dismiss", id });
    },

    listNotifications() {
      return [...notifications.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },

    subscribe(listener: ShellNotificationListener) {
      listeners.add(listener);

      return createDisposable(() => {
        listeners.delete(listener);
      });
    },
  };
};

export type NotificationRegistry = ReturnType<typeof createNotificationRegistry>;
