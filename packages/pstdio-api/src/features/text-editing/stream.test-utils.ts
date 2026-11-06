import { OpenAPIHono } from "@hono/zod-openapi";
import type { createNativeDocumentService } from "../../services/native-documents/documents";
import type { createTextEditingService } from "../../services/text-editing/service";
import type { AppBindings } from "../../types";
import { createNativeDocumentRoutes } from "../native-documents/routes";
import {
  openSessionStreamHandler,
  subscribeSessionStreamHandler,
  subscribeSessionStreamRoute,
  unsubscribeSessionStreamHandler,
  unsubscribeSessionStreamRoute,
} from "../sessions/endpoints/session-stream";
import { createSessionStreamConnections } from "../sessions/session-stream-connections";
import { createTextEditingRoutes } from "./routes";

export const createTextStreamTestApp = (
  textEditing: ReturnType<typeof createTextEditingService> | undefined,
  nativeDocuments?: ReturnType<typeof createNativeDocumentService>,
) => {
  const app = new OpenAPIHono<AppBindings>();
  const routes = new OpenAPIHono<AppBindings>();
  const connections = createSessionStreamConnections();
  if (textEditing) routes.route("/", createTextEditingRoutes(textEditing));
  if (nativeDocuments) routes.route("/", createNativeDocumentRoutes(nativeDocuments));
  routes.get("/session-stream", openSessionStreamHandler(connections));
  // This fixture exercises only text subscriptions; the real text service owns admission and events.
  const deps = { textEditing, nativeDocuments } as Parameters<typeof subscribeSessionStreamHandler>[0];
  routes.openapi(subscribeSessionStreamRoute, subscribeSessionStreamHandler(deps, connections));
  routes.openapi(unsubscribeSessionStreamRoute, unsubscribeSessionStreamHandler(connections));
  app.route("/v1", routes);
  return app;
};
