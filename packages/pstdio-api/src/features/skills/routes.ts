import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { copyExtensionSkillHandler, copyExtensionSkillRoute } from "./endpoints/copy-extension-skill";
import {
  getExtensionSkillContentHandler,
  getExtensionSkillContentRoute,
} from "./endpoints/get-extension-skill-content";
import { getSkillHandler, getSkillRoute } from "./endpoints/get-skill";
import { listSkillsHandler, listSkillsRoute } from "./endpoints/list-skills";
import {
  setExtensionSkillPreferenceHandler,
  setExtensionSkillPreferenceRoute,
} from "./endpoints/set-extension-skill-preference";

export const createSkillRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  // Extension-default action routes register before /skills/{name} for literal-path priority.
  routes.openapi(getExtensionSkillContentRoute, getExtensionSkillContentHandler(deps));
  routes.openapi(setExtensionSkillPreferenceRoute, setExtensionSkillPreferenceHandler(deps));
  routes.openapi(copyExtensionSkillRoute, copyExtensionSkillHandler(deps));

  routes.openapi(listSkillsRoute, listSkillsHandler(deps));
  routes.openapi(getSkillRoute, getSkillHandler(deps));

  return routes;
};
