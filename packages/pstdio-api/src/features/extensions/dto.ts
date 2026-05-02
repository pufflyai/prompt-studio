import { z } from "@hono/zod-openapi";
import {
  commandExecuteRequestSchema,
  commandExecuteResponseSchema,
  extensionsCheckResponseSchema,
} from "pstdio-api-contracts";

export const extensionsCheckQuerySchema = z.object({}).strict();

export const extensionsCheckOpenApiResponseSchema = extensionsCheckResponseSchema;

export const commandExecuteParamsSchema = z.object({ commandId: z.string().min(1) });
export const commandExecuteBodySchema = commandExecuteRequestSchema;
export const commandExecuteOpenApiResponseSchema = commandExecuteResponseSchema;
