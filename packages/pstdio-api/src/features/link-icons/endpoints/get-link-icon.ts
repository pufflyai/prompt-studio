import { createRoute, z } from "@hono/zod-openapi";
import { linkIconSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { LinkIconFetcher } from "../link-icon-fetcher";

export const getLinkIconRoute = createRoute({
  method: "get",
  path: "/link-icons",
  description: "Get the icon of the web page at an http or https URL.",
  tags: ["Link icons"],
  request: {
    query: z.object({ url: z.string() }),
  },
  responses: {
    200: {
      description: "The page icon as a data URL.",
      content: { "application/json": { schema: linkIconSchema } },
    },
    404: {
      description: "The page has no icon that can be shown, or the URL is not allowed.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const getLinkIconHandler = (fetcher: LinkIconFetcher): AppRouteHandler<typeof getLinkIconRoute> => {
  return async (c) => {
    const dataUrl = await fetcher.get(c.req.valid("query").url);
    if (!dataUrl) return c.json({ error: "No icon found." }, 404);
    return c.json({ data_url: dataUrl }, 200);
  };
};
