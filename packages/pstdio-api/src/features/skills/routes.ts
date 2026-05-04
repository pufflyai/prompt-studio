import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { SkillsRouteDeps } from "./deps";
import { getSkillHandler, getSkillRoute } from "./endpoints/get-skill";
import { listSkillsHandler, listSkillsRoute } from "./endpoints/list-skills";
import { updateSkillHandler, updateSkillRoute } from "./endpoints/update-skill";

export const createSkillRoutes = (deps: SkillsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listSkillsRoute, listSkillsHandler(deps));
  routes.openapi(getSkillRoute, getSkillHandler(deps));
  routes.openapi(updateSkillRoute, updateSkillHandler(deps));

  return routes;
};
