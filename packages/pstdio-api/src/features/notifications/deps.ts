import type { RouteDeps } from "../deps";

export type NotificationsRouteDeps = Pick<
  RouteDeps,
  "eventBus" | "notificationsService" | "activityEventsService" | "projectService"
>;
