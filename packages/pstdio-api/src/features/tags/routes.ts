import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { createTagHandler, createTagRoute } from "./endpoints/create-tag";
import { createTagOptionHandler, createTagOptionRoute } from "./endpoints/create-tag-option";
import { deleteTagHandler, deleteTagRoute } from "./endpoints/delete-tag";
import { deleteTagOptionHandler, deleteTagOptionRoute } from "./endpoints/delete-tag-option";
import { listTagsHandler, listTagsRoute } from "./endpoints/list-tags";
import { updateTagHandler, updateTagRoute } from "./endpoints/update-tag";
import { updateTagOptionHandler, updateTagOptionRoute } from "./endpoints/update-tag-option";

export const createTagRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.openapi(createTagRoute, createTagHandler(deps));
  routes.openapi(listTagsRoute, listTagsHandler(deps));
  routes.openapi(updateTagRoute, updateTagHandler(deps));
  routes.openapi(deleteTagRoute, deleteTagHandler(deps));
  routes.openapi(createTagOptionRoute, createTagOptionHandler(deps));
  routes.openapi(updateTagOptionRoute, updateTagOptionHandler(deps));
  routes.openapi(deleteTagOptionRoute, deleteTagOptionHandler(deps));
  return routes;
};
