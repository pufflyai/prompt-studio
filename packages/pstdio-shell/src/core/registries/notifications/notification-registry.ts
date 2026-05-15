import {
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createShellStore, type ShellStore } from "../../shared/store/shell-store";
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

export interface ShellNotificationStoreState {
  notifications: Record<string, RegisteredShellNotification>;
}

export interface NotificationRegistry {
  store: ShellStore<ShellNotificationStoreState>;
  show(notification: ShellNotification, metadata?: ContributionMetadata): RegisteredShellNotification;
  dismiss(id: string): boolean;
  clear(): void;
  listNotifications(): RegisteredShellNotification[];
  subscribe(listener: ShellNotificationListener): Disposable;
}

export const createNotificationRegistry = (): NotificationRegistry => {
  const store = createShellStore<ShellNotificationStoreState>({
    name: "shell.notifications",
    initialState: { notifications: {} },
  });

  const listeners = new Set<ShellNotificationListener>();
  let generatedId = 0;

  const emit = (event: ShellNotificationEvent) => {
    for (const listener of listeners) listener(event);
  };

  return {
    store,

    show(notification, metadata) {
      let id = notification.id;
      if (!id) {
        generatedId += 1;
        id = `shell.notification.${generatedId.toString()}`;
      }

      const record: RegisteredShellNotification = {
        ...normalizeContributionMetadata(metadata),
        ...notification,
        id,
        createdAt: notification.createdAt ?? new Date().toISOString(),
      };

      const snapshot = store.getState();
      store.setState({ notifications: { ...snapshot.notifications, [id]: record } }, false, "showNotification");
      emit({ type: "show", id, notification: record });

      return record;
    },

    dismiss(id) {
      const snapshot = store.getState();
      if (!snapshot.notifications[id]) return false;
      const { [id]: _removed, ...rest } = snapshot.notifications;
      store.setState({ notifications: rest }, false, "dismissNotification");
      emit({ type: "dismiss", id });
      return true;
    },

    clear() {
      const ids = Object.keys(store.getState().notifications);
      store.setState({ notifications: {} }, false, "clearNotifications");
      for (const id of ids) emit({ type: "dismiss", id });
    },

    listNotifications() {
      return Object.values(store.getState().notifications).sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      );
    },

    subscribe(listener) {
      listeners.add(listener);
      return createDisposable(() => {
        listeners.delete(listener);
      });
    },
  };
};
