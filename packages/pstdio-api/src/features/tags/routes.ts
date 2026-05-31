import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { TagsRouteDeps } from "./deps";
import { createTagHandler, createTagRoute } from "./endpoints/create-tag";
import { createTagOptionHandler, createTagOptionRoute } from "./endpoints/create-tag-option";
import { deleteTagHandler, deleteTagRoute } from "./endpoints/delete-tag";
import { deleteTagOptionHandler, deleteTagOptionRoute } from "./endpoints/delete-tag-option";
import { listTagsHandler, listTagsRoute } from "./endpoints/list-tags";
import { updateTagHandler, updateTagRoute } from "./endpoints/update-tag";
import { updateTagOptionHandler, updateTagOptionRoute } from "./endpoints/update-tag-option";

/** @deprecated Legacy core ticket tag routes. Ticket tags are owned by the pstdio tickets extension. */
export const createTagRoutes = (deps: TagsRouteDeps) => {
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
