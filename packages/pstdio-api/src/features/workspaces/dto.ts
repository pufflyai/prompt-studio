import { z } from "@hono/zod-openapi";
import { createWorkspaceInputSchema, workspaceListItemSchema, workspaceSchema } from "pstdio-api-contracts";

export const workspaceResponseSchema = workspaceSchema;
export { workspaceListItemSchema };
export const createWorkspaceBodySchema = createWorkspaceInputSchema.strict();

export const uploadStartupLogBodySchema = z.object({ content_base64: z.string() }).strict();
export const notFoundResponseSchema = z.object({ error: z.string() });
