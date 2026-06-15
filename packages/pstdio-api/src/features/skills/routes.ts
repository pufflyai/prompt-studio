import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { SkillsRouteDeps } from "./deps";
import { getSkillHandler, getSkillRoute } from "./endpoints/get-skill";
import { listSkillsHandler, listSkillsRoute } from "./endpoints/list-skills";
import { updateSkillInstallationHandler, updateSkillInstallationRoute } from "./endpoints/update-skill-installation";
import { updateSkillPreferencesHandler, updateSkillPreferencesRoute } from "./endpoints/update-skill-preferences";

export const createSkillRoutes = (deps: SkillsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listSkillsRoute, listSkillsHandler(deps));
  routes.openapi(updateSkillInstallationRoute, updateSkillInstallationHandler(deps));
  routes.openapi(getSkillRoute, getSkillHandler(deps));
  routes.openapi(updateSkillPreferencesRoute, updateSkillPreferencesHandler(deps));

  return routes;
};
