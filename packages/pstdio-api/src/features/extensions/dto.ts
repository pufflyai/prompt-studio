import { z } from "@hono/zod-openapi";
import { extensionsCheckResponseSchema } from "pstdio-api-contracts";

export const extensionsCheckQuerySchema = z.object({}).strict();

export const extensionsCheckOpenApiResponseSchema = extensionsCheckResponseSchema;
