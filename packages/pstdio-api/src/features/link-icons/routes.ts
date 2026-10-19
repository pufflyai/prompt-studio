import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import { getLinkIconHandler, getLinkIconRoute } from "./endpoints/get-link-icon";
import { createLinkIconFetcher, type LinkIconFetcher } from "./link-icon-fetcher";

export const createLinkIconRoutes = (fetcher: LinkIconFetcher = createLinkIconFetcher()) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(getLinkIconRoute, getLinkIconHandler(fetcher));

  return routes;
};
