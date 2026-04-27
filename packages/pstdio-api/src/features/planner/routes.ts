import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { pullPlannerTicketsHandler, pullPlannerTicketsRoute } from "./endpoints/pull-tickets";
import { pushPlannerTicketHandler, pushPlannerTicketRoute } from "./endpoints/push-ticket";

export const createPlannerRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(pullPlannerTicketsRoute, pullPlannerTicketsHandler(deps));
  routes.openapi(pushPlannerTicketRoute, pushPlannerTicketHandler(deps));

  return routes;
};
