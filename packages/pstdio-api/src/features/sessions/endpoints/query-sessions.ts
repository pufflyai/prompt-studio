import { createRoute, z } from "@hono/zod-openapi";
import { extensionSessionSchema, sessionSchema, sessionStatusSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { queryExtensionSessions, SessionQueryWorkspaceNotFound } from "../query-sessions";

const querySchema = z
  .object({
    status: z
      .string()
      .optional()
      .transform((value) => (value === "" ? [] : value?.split(",")))
      .pipe(z.array(sessionStatusSchema).optional()),
    agent: z.string().optional(),
    workspaceId: z.string().optional(),
    createdFrom: z.iso.datetime({ offset: true }).optional(),
    createdTo: z.iso.datetime({ offset: true }).optional(),
    updatedFrom: z.iso.datetime({ offset: true }).optional(),
    includeArchived: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    cursor: z.string().optional(),
    limit: z.coerce.number().optional(),
    anchorType: z.string().optional(),
    anchorId: z.string().optional(),
  })
  .strict()
  .refine((input) => (input.anchorType !== undefined) === (input.anchorId !== undefined), {
    message: "Provide both anchorType and anchorId",
  });
const summarySchema = sessionSchema
  .pick({
    id: true,
    title: true,
    status: true,
    archived: true,
    agent: true,
    last_selected_model: true,
    original_session_id: true,
    created_at: true,
    updated_at: true,
    last_request_started: true,
    last_request_ended: true,
    anchors_json: true,
    cwd: true,
  })
  .extend({ workspace_id: z.string().nullable(), ...extensionSessionSchema.shape });
export const querySessionsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/sessions",
  tags: ["Sessions"],
  description: "Query sessions, newest first. Status accepts a comma-separated list; an empty list matches nothing.",
  request: { params: z.object({ projectId: z.string() }), query: querySchema },
  responses: {
    200: {
      description: "One bounded page of sessions.",
      content: {
        "application/json": {
          schema: z.object({
            items: z.array(summarySchema),
            nextCursor: z.string().nullable(),
          }),
        },
      },
    },
    404: {
      description: "Workspace not found in this project.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});
export const querySessionsHandler = (deps: SessionsRouteDeps) => {
  const handler: AppRouteHandler<typeof querySessionsRoute> = async (c) => {
    const { projectId } = c.req.valid("param");
    const { anchorType, anchorId, ...input } = c.req.valid("query");
    try {
      return c.json(
        await queryExtensionSessions(
          deps,
          projectId,
          {
            ...input,
            anchor: anchorType !== undefined && anchorId !== undefined ? { type: anchorType, id: anchorId } : undefined,
          },
          c.req.raw.signal,
        ),
        200,
      );
    } catch (error) {
      if (error instanceof SessionQueryWorkspaceNotFound) return c.json({ error: error.message }, 404);
      throw error;
    }
  };
  return handler;
};
