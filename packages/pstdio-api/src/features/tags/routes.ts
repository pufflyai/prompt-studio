import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { createTagHandler, createTagRoute } from "./endpoints/create-tag";
import { deleteTagHandler, deleteTagRoute } from "./endpoints/delete-tag";
import { listTagsHandler, listTagsRoute } from "./endpoints/list-tags";
import { updateTagColorHandler, updateTagColorRoute } from "./endpoints/update-tag-color";

export const createTagRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.openapi(createTagRoute, createTagHandler(deps));
  routes.openapi(listTagsRoute, listTagsHandler(deps));
  routes.openapi(updateTagColorRoute, updateTagColorHandler(deps));
  routes.openapi(deleteTagRoute, deleteTagHandler(deps));
  return routes;
};
