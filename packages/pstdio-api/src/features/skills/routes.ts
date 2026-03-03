import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { listSkillsHandler, listSkillsRoute } from "./endpoints/list-skills";

export const createSkillRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.openapi(listSkillsRoute, listSkillsHandler(deps));
  return routes;
};
