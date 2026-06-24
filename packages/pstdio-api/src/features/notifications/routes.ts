import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { NotificationsRouteDeps } from "./deps";
import { createNotificationHandler, createNotificationRoute } from "./endpoints/create-notification";
import { getNotificationHandler, getNotificationRoute } from "./endpoints/get-notification";
import {
  countNotificationsHandler,
  countNotificationsRoute,
  listNotificationsHandler,
  listNotificationsRoute,
} from "./endpoints/list-notifications";
import {
  dismissNotificationHandler,
  dismissNotificationRoute,
  markNotificationDoneHandler,
  markNotificationDoneRoute,
  markNotificationReadHandler,
  markNotificationReadRoute,
  resolveNotificationByDedupeKeyHandler,
  resolveNotificationByDedupeKeyRoute,
  snoozeNotificationHandler,
  snoozeNotificationRoute,
} from "./endpoints/transition-notification";
import { updateNotificationHandler, updateNotificationRoute } from "./endpoints/update-notification";

export const createNotificationsRoutes = (deps: NotificationsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listNotificationsRoute, listNotificationsHandler(deps));
  routes.openapi(countNotificationsRoute, countNotificationsHandler(deps));
  routes.openapi(createNotificationRoute, createNotificationHandler(deps));
  routes.openapi(resolveNotificationByDedupeKeyRoute, resolveNotificationByDedupeKeyHandler(deps));
  routes.openapi(getNotificationRoute, getNotificationHandler(deps));
  routes.openapi(updateNotificationRoute, updateNotificationHandler(deps));
  routes.openapi(markNotificationReadRoute, markNotificationReadHandler(deps));
  routes.openapi(dismissNotificationRoute, dismissNotificationHandler(deps));
  routes.openapi(markNotificationDoneRoute, markNotificationDoneHandler(deps));
  routes.openapi(snoozeNotificationRoute, snoozeNotificationHandler(deps));

  return routes;
};
