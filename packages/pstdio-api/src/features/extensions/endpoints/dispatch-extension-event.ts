import { createRoute, z } from "@hono/zod-openapi";
import { type DispatchExtensionEventInput, dispatchExtensionEventBodySchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { fireExtensionEvent } from "../extension-event-runtime";

const dispatchExtensionEventParamsSchema = z.object({ projectId: z.string() }).strict();

export const dispatchExtensionEventRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/events/dispatch",
  tags: ["Extensions"],
  request: {
    params: dispatchExtensionEventParamsSchema,
    body: { content: { "application/json": { schema: dispatchExtensionEventBodySchema } } },
  },
  responses: {
    204: { description: "Extension event dispatched." },
  },
});

export const dispatchExtensionEventHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof dispatchExtensionEventRoute> => {
  const handler = async (c: never) => {
    const context = c as {
      req: { valid: (target: "param" | "json") => unknown };
      body: (body: null, status: 204) => Response;
    };
    const { projectId } = context.req.valid("param") as { projectId: string };
    const { eventId, payload } = context.req.valid("json") as DispatchExtensionEventInput;

    await fireExtensionEvent(deps, projectId, eventId, payload);

    return context.body(null, 204);
  };
  return handler as unknown as AppRouteHandler<typeof dispatchExtensionEventRoute>;
};
