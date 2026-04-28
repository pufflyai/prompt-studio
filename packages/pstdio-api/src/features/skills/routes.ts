import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { copySkillHandler, copySkillRoute } from "./endpoints/copy-skill";
import { editSkillHandler, editSkillRoute } from "./endpoints/edit-skill";
import { getSkillHandler, getSkillRoute } from "./endpoints/get-skill";
import { listSkillsHandler, listSkillsRoute } from "./endpoints/list-skills";
import {
  disableSkillDefaultHandler,
  disableSkillDefaultRoute,
  enableSkillDefaultHandler,
  enableSkillDefaultRoute,
} from "./endpoints/set-skill-default-enabled";
import { updateSkillHandler, updateSkillRoute } from "./endpoints/update-skill";

export const createSkillRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listSkillsRoute, listSkillsHandler(deps));
  routes.openapi(copySkillRoute, copySkillHandler(deps));
  routes.openapi(disableSkillDefaultRoute, disableSkillDefaultHandler(deps));
  routes.openapi(enableSkillDefaultRoute, enableSkillDefaultHandler(deps));
  routes.openapi(editSkillRoute, editSkillHandler(deps));
  routes.openapi(getSkillRoute, getSkillHandler(deps));
  routes.openapi(updateSkillRoute, updateSkillHandler(deps));

  return routes;
};
