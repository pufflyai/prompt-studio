import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { approveSessionHandler, approveSessionRoute } from "./endpoints/approve-session";
import { archiveSessionHandler, archiveSessionRoute } from "./endpoints/archive-session";
import { createSessionHandler, createSessionRoute } from "./endpoints/create-session";
import { followUpSessionHandler, followUpSessionRoute } from "./endpoints/follow-up-session";
import { getSessionHandler, getSessionRoute } from "./endpoints/get-session";
import { getSessionConversationHandler, getSessionConversationRoute } from "./endpoints/get-session-conversation";
import { listSessionsHandler, listSessionsRoute } from "./endpoints/list-sessions";
import { streamSessionHandler } from "./endpoints/stream-session";
import { updateSessionStatusHandler, updateSessionStatusRoute } from "./endpoints/update-session-status";

export const createSessionRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(createSessionRoute, createSessionHandler(deps));
  routes.openapi(listSessionsRoute, listSessionsHandler(deps));
  routes.openapi(getSessionRoute, getSessionHandler(deps));
  routes.openapi(getSessionConversationRoute, getSessionConversationHandler(deps));
  routes.openapi(updateSessionStatusRoute, updateSessionStatusHandler(deps));
  routes.openapi(archiveSessionRoute, archiveSessionHandler(deps));
  routes.openapi(followUpSessionRoute, followUpSessionHandler(deps));
  routes.openapi(approveSessionRoute, approveSessionHandler(deps));

  // SSE stream endpoint (not OpenAPI — raw Hono handler)
  routes.get("/sessions/:id/stream", streamSessionHandler(deps));

  return routes;
};
