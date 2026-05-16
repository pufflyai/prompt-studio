import {
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { ResourceRef } from "../resources/resource-registry";

export type WorkbenchNotificationLevel = "info" | "success" | "warning" | "error";

export interface WorkbenchNotificationAction {
  commandId: string;
  title: string;
  args?: unknown;
}

export interface WorkbenchNotification {
  id?: string;
  level: WorkbenchNotificationLevel;
  title: string;
  message?: string;
  createdAt?: string;
  resource?: ResourceRef;
  actions?: WorkbenchNotificationAction[];
  metadata?: Record<string, unknown>;
}

export interface RegisteredWorkbenchNotification extends RegisteredContributionMetadata {
  id: string;
  level: WorkbenchNotificationLevel;
  title: string;
  message?: string;
  createdAt: string;
  resource?: ResourceRef;
  actions?: WorkbenchNotificationAction[];
  metadata?: Record<string, unknown>;
}

export type WorkbenchNotificationEvent =
  | { type: "show"; id: string; notification: RegisteredWorkbenchNotification }
  | { type: "dismiss"; id: string };

type WorkbenchNotificationListener = (event: WorkbenchNotificationEvent) => void;

export interface WorkbenchNotificationStoreState {
  notifications: Record<string, RegisteredWorkbenchNotification>;
}

export interface NotificationRegistry {
  store: WorkbenchStore<WorkbenchNotificationStoreState>;
  show(notification: WorkbenchNotification, metadata?: ContributionMetadata): RegisteredWorkbenchNotification;
  dismiss(id: string): boolean;
  clear(): void;
  listNotifications(): RegisteredWorkbenchNotification[];
  subscribe(listener: WorkbenchNotificationListener): Disposable;
}

export const createNotificationRegistry = (): NotificationRegistry => {
  const store = createWorkbenchStore<WorkbenchNotificationStoreState>({
    name: "workbench.notifications",
    initialState: { notifications: {} },
  });

  const listeners = new Set<WorkbenchNotificationListener>();
  let generatedId = 0;

  const emit = (event: WorkbenchNotificationEvent) => {
    for (const listener of listeners) listener(event);
  };

  return {
    store,

    show(notification, metadata) {
      let id = notification.id;
      if (!id) {
        generatedId += 1;
        id = `workbench.notification.${generatedId.toString()}`;
      }

      const record: RegisteredWorkbenchNotification = {
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
