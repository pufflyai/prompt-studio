import { OpenAPIHono } from "@hono/zod-openapi";
import type { createTextEditingService } from "../../services/text-editing/service";
import type { AppBindings } from "../../types";
import {
  openSessionStreamHandler,
  subscribeSessionStreamHandler,
  subscribeSessionStreamRoute,
  unsubscribeSessionStreamHandler,
  unsubscribeSessionStreamRoute,
} from "../sessions/endpoints/session-stream";
import { createSessionStreamConnections } from "../sessions/session-stream-connections";
import { createTextEditingRoutes } from "./routes";

export const createTextStreamTestApp = (textEditing: ReturnType<typeof createTextEditingService>) => {
  const app = new OpenAPIHono<AppBindings>();
  const routes = new OpenAPIHono<AppBindings>();
  const connections = createSessionStreamConnections();
  routes.route("/", createTextEditingRoutes(textEditing));
  routes.get("/session-stream", openSessionStreamHandler(connections));
  // This fixture exercises only text subscriptions; the real text service owns admission and events.
  const deps = { textEditing } as Parameters<typeof subscribeSessionStreamHandler>[0];
  routes.openapi(subscribeSessionStreamRoute, subscribeSessionStreamHandler(deps, connections));
  routes.openapi(unsubscribeSessionStreamRoute, unsubscribeSessionStreamHandler(connections));
  app.route("/v1", routes);
  return app;
};
