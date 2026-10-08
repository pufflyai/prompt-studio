import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import type { SessionsRouteDeps } from "./deps";
import { approveSessionHandler, approveSessionRoute } from "./endpoints/approve-session";
import { archiveSessionHandler, archiveSessionRoute } from "./endpoints/archive-session";
import { createSessionHandler, createSessionRoute } from "./endpoints/create-session";
import { draftHarnessCommandsHandler, draftHarnessCommandsRoute } from "./endpoints/draft-harness-commands";
import { followUpSessionHandler, followUpSessionRoute } from "./endpoints/follow-up-session";
import { getConversationSourcesHandler, getConversationSourcesRoute } from "./endpoints/get-conversation-sources";
import { getQueuedMessagesHandler, getQueuedMessagesRoute } from "./endpoints/get-queued-messages";
import { getSessionHandler, getSessionRoute } from "./endpoints/get-session";
import { getSessionConversationHandler, getSessionConversationRoute } from "./endpoints/get-session-conversation";
import {
  getHarnessCommandsHandler,
  getHarnessCommandsRoute,
  invokeHarnessCommandHandler,
  invokeHarnessCommandRoute,
} from "./endpoints/harness-commands";
import { listSessionActivityHandler, listSessionActivityRoute } from "./endpoints/list-session-activity";
import { listSessionsHandler, listSessionsRoute } from "./endpoints/list-sessions";
import {
  combineQueuedFollowUpsHandler,
  combineQueuedFollowUpsRoute,
  pendingQueuedFollowUpsHandler,
  pendingQueuedFollowUpsRoute,
} from "./endpoints/pending-queued-follow-ups";
import {
  deleteQueuedFollowUpHandler,
  deleteQueuedFollowUpRoute,
  moveQueuedFollowUpHandler,
  moveQueuedFollowUpRoute,
  updateQueuedFollowUpHandler,
  updateQueuedFollowUpRoute,
} from "./endpoints/queued-follow-ups";
import { renameSessionHandler, renameSessionRoute } from "./endpoints/rename-session";
import { resolveSessionIdHandler, resolveSessionIdRoute } from "./endpoints/resolve-session-id";
import {
  deleteSessionAttachmentHandler,
  deleteSessionAttachmentRoute,
  getSessionAttachmentContentHandler,
  getSessionAttachmentContentRoute,
  uploadSessionAttachmentHandler,
  uploadSessionAttachmentRoute,
} from "./endpoints/session-attachment-files";
import {
  openSessionStreamHandler,
  subscribeSessionStreamHandler,
  subscribeSessionStreamRoute,
  unsubscribeSessionStreamHandler,
  unsubscribeSessionStreamRoute,
} from "./endpoints/session-stream";
import { steerQueuedFollowUpHandler, steerQueuedFollowUpRoute } from "./endpoints/steer-queued-follow-up";
import { updateSessionStatusHandler, updateSessionStatusRoute } from "./endpoints/update-session-status";
import { createSessionStreamConnections } from "./session-stream-connections";

export const createSessionRoutes = (deps: SessionsRouteDeps & ExtensionsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  const streamConnections = createSessionStreamConnections();
  routes.openapi(draftHarnessCommandsRoute, draftHarnessCommandsHandler(deps));

  routes.openapi(getHarnessCommandsRoute, getHarnessCommandsHandler(deps));
  routes.openapi(invokeHarnessCommandRoute, invokeHarnessCommandHandler(deps));
  routes.openapi(createSessionRoute, createSessionHandler(deps));
  routes.openapi(uploadSessionAttachmentRoute, uploadSessionAttachmentHandler(deps));
  routes.openapi(getSessionAttachmentContentRoute, getSessionAttachmentContentHandler(deps));
  routes.openapi(deleteSessionAttachmentRoute, deleteSessionAttachmentHandler(deps));
  routes.openapi(listSessionsRoute, listSessionsHandler(deps));
  routes.openapi(resolveSessionIdRoute, resolveSessionIdHandler(deps));
  routes.openapi(getSessionRoute, getSessionHandler(deps));
  routes.openapi(listSessionActivityRoute, listSessionActivityHandler(deps));
  routes.openapi(getSessionConversationRoute, getSessionConversationHandler(deps));
  routes.openapi(getConversationSourcesRoute, getConversationSourcesHandler(deps));
  routes.openapi(getQueuedMessagesRoute, getQueuedMessagesHandler(deps));
  routes.openapi(updateSessionStatusRoute, updateSessionStatusHandler(deps));
  routes.openapi(renameSessionRoute, renameSessionHandler(deps));
  routes.openapi(archiveSessionRoute, archiveSessionHandler(deps));
  routes.openapi(followUpSessionRoute, followUpSessionHandler(deps));
  routes.openapi(steerQueuedFollowUpRoute, steerQueuedFollowUpHandler(deps));
  routes.openapi(pendingQueuedFollowUpsRoute, pendingQueuedFollowUpsHandler(deps));
  routes.openapi(combineQueuedFollowUpsRoute, combineQueuedFollowUpsHandler(deps));
  routes.openapi(updateQueuedFollowUpRoute, updateQueuedFollowUpHandler(deps));
  routes.openapi(deleteQueuedFollowUpRoute, deleteQueuedFollowUpHandler(deps));
  routes.openapi(moveQueuedFollowUpRoute, moveQueuedFollowUpHandler(deps));
  routes.openapi(approveSessionRoute, approveSessionHandler(deps));
  routes.openapi(subscribeSessionStreamRoute, subscribeSessionStreamHandler(deps, streamConnections));
  routes.openapi(unsubscribeSessionStreamRoute, unsubscribeSessionStreamHandler(streamConnections));

  // SSE stream endpoint (not OpenAPI — raw Hono handler)
  routes.get("/session-stream", openSessionStreamHandler(streamConnections));

  return routes;
};
