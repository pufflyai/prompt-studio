import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { SessionsRouteDeps } from "./deps";
import { approveSessionHandler, approveSessionRoute } from "./endpoints/approve-session";
import { archiveSessionHandler, archiveSessionRoute } from "./endpoints/archive-session";
import { createSessionHandler, createSessionRoute } from "./endpoints/create-session";
import { followUpSessionHandler, followUpSessionRoute } from "./endpoints/follow-up-session";
import { getSessionHandler, getSessionRoute } from "./endpoints/get-session";
import { getSessionConversationHandler, getSessionConversationRoute } from "./endpoints/get-session-conversation";
import { listSessionActivityHandler, listSessionActivityRoute } from "./endpoints/list-session-activity";
import { listSessionsHandler, listSessionsRoute } from "./endpoints/list-sessions";
import {
  deleteQueuedFollowUpHandler,
  deleteQueuedFollowUpRoute,
  moveQueuedFollowUpHandler,
  moveQueuedFollowUpRoute,
  updateQueuedFollowUpHandler,
  updateQueuedFollowUpRoute,
} from "./endpoints/queued-follow-ups";
import { resolveSessionIdHandler, resolveSessionIdRoute } from "./endpoints/resolve-session-id";
import {
  deleteSessionAttachmentHandler,
  deleteSessionAttachmentRoute,
  getSessionAttachmentContentHandler,
  getSessionAttachmentContentRoute,
  uploadSessionAttachmentHandler,
  uploadSessionAttachmentRoute,
} from "./endpoints/session-attachment-files";
import { streamSessionHandler } from "./endpoints/stream-session";
import { updateSessionStatusHandler, updateSessionStatusRoute } from "./endpoints/update-session-status";

export const createSessionRoutes = (deps: SessionsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(createSessionRoute, createSessionHandler(deps));
  routes.openapi(uploadSessionAttachmentRoute, uploadSessionAttachmentHandler(deps));
  routes.openapi(getSessionAttachmentContentRoute, getSessionAttachmentContentHandler(deps));
  routes.openapi(deleteSessionAttachmentRoute, deleteSessionAttachmentHandler(deps));
  routes.openapi(listSessionsRoute, listSessionsHandler(deps));
  routes.openapi(resolveSessionIdRoute, resolveSessionIdHandler(deps));
  routes.openapi(getSessionRoute, getSessionHandler(deps));
  routes.openapi(listSessionActivityRoute, listSessionActivityHandler(deps));
  routes.openapi(getSessionConversationRoute, getSessionConversationHandler(deps));
  routes.openapi(updateSessionStatusRoute, updateSessionStatusHandler(deps));
  routes.openapi(archiveSessionRoute, archiveSessionHandler(deps));
  routes.openapi(followUpSessionRoute, followUpSessionHandler(deps));
  routes.openapi(updateQueuedFollowUpRoute, updateQueuedFollowUpHandler(deps));
  routes.openapi(deleteQueuedFollowUpRoute, deleteQueuedFollowUpHandler(deps));
  routes.openapi(moveQueuedFollowUpRoute, moveQueuedFollowUpHandler(deps));
  routes.openapi(approveSessionRoute, approveSessionHandler(deps));

  // SSE stream endpoint (not OpenAPI — raw Hono handler)
  routes.get("/sessions/:id/stream", streamSessionHandler(deps));

  return routes;
};
