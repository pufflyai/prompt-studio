import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { NotificationsRouteDeps } from "./deps";
import { countNotificationsHandler, countNotificationsRoute } from "./endpoints/count-notifications";
import { createNotificationHandler, createNotificationRoute } from "./endpoints/create-notification";
import { getNotificationHandler, getNotificationRoute } from "./endpoints/get-notification";
import { listNotificationsHandler, listNotificationsRoute } from "./endpoints/list-notifications";
import {
  dismissNotificationHandler,
  dismissNotificationRoute,
  doneNotificationHandler,
  doneNotificationRoute,
  readNotificationHandler,
  readNotificationRoute,
  snoozeNotificationHandler,
  snoozeNotificationRoute,
} from "./endpoints/notification-transitions";
import { resolveByDedupeKeyHandler, resolveByDedupeKeyRoute } from "./endpoints/resolve-by-dedupe-key";
import { updateNotificationHandler, updateNotificationRoute } from "./endpoints/update-notification";

export const createNotificationRoutes = (deps: NotificationsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listNotificationsRoute, listNotificationsHandler(deps));
  routes.openapi(countNotificationsRoute, countNotificationsHandler(deps));
  routes.openapi(createNotificationRoute, createNotificationHandler(deps));
  // Resolve-by-dedupe-key must register before /:id to avoid collisions.
  routes.openapi(resolveByDedupeKeyRoute, resolveByDedupeKeyHandler(deps));
  routes.openapi(getNotificationRoute, getNotificationHandler(deps));
  routes.openapi(updateNotificationRoute, updateNotificationHandler(deps));
  routes.openapi(readNotificationRoute, readNotificationHandler(deps));
  routes.openapi(dismissNotificationRoute, dismissNotificationHandler(deps));
  routes.openapi(doneNotificationRoute, doneNotificationHandler(deps));
  routes.openapi(snoozeNotificationRoute, snoozeNotificationHandler(deps));

  return routes;
};
