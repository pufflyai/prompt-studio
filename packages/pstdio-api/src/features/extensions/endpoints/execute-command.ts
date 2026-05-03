import { createRoute } from "@hono/zod-openapi";
import type { JsonObject, ResourceRef, SlotInvocationContext } from "@pstdio/sdk/extensions";
import type { CommandExecuteResponse } from "pstdio-api-contracts";
import type { CommandExecuteInput } from "pstdio-extensions";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { commandExecuteBodySchema, commandExecuteOpenApiResponseSchema, commandExecuteParamsSchema } from "../dto";

export const executeCommandRoute = createRoute({
  method: "post",
  path: "/extensions/commands/{commandId}/execute",
  description: "Execute a v2 extension command and return its outcome.",
  tags: ["Extensions"],
  request: {
    params: commandExecuteParamsSchema,
    body: { content: { "application/json": { schema: commandExecuteBodySchema } } },
  },
  responses: {
    200: {
      description: "Command execution outcome.",
      content: { "application/json": { schema: commandExecuteOpenApiResponseSchema } },
    },
  },
});

export const executeCommandHandler = (deps: RouteDeps): AppRouteHandler<typeof executeCommandRoute> => {
  return async (c) => {
    const { commandId } = c.req.valid("param");
    const body = c.req.valid("json");

    const input: CommandExecuteInput = {
      commandId,
      projectId: body.projectId,
      params: body.params as JsonObject | undefined,
      resource: body.resource as ResourceRef | undefined,
      slot: body.slot as SlotInvocationContext | undefined,
      repo: body.repo,
      source: body.source,
      metadata: body.metadata as JsonObject | undefined,
    };

    const result = await deps.extensionService.execute(input);

    const response: CommandExecuteResponse = {
      commandId: result.commandId,
      extensionId: result.extensionId,
      outcome: result.outcome as CommandExecuteResponse["outcome"],
    };
    return c.json(response, 200);
  };
};
