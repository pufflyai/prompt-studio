import { z } from "@hono/zod-openapi";
import {
  commandExecuteRequestSchema,
  commandExecuteResponseSchema,
  extensionsCheckResponseSchema,
  setupProjectExtensionResponseSchema,
} from "pstdio-api-contracts";

export const extensionsCheckQuerySchema = z.object({}).strict();

export const extensionsCheckOpenApiResponseSchema = extensionsCheckResponseSchema;

export const commandExecuteParamsSchema = z.object({ commandId: z.string().min(1) });
export const commandExecuteBodySchema = commandExecuteRequestSchema;
export const commandExecuteOpenApiResponseSchema = commandExecuteResponseSchema;
export const setupProjectExtensionParamsSchema = z
  .object({
    projectId: z.string().min(1),
    installName: z.string().min(1),
  })
  .strict();
export const setupProjectExtensionBodySchema = z.object({}).strict();
export const setupProjectExtensionOpenApiResponseSchema = setupProjectExtensionResponseSchema;
export const extensionNotFoundResponseSchema = z.object({ error: z.string() });
