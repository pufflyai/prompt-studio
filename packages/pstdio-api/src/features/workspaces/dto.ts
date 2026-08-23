import { z } from "@hono/zod-openapi";
import {
  createWorkspaceInputSchema,
  moveWorkspaceEntryInputSchema,
  renameWorkspaceInputSchema,
  workspaceFileContentSchema,
  workspaceFileEntrySchema,
  workspaceFilesResponseSchema,
  workspaceListItemSchema,
  workspaceSchema,
  writeWorkspaceFileInputSchema,
} from "pstdio-api-contracts";

export const workspaceResponseSchema = workspaceSchema;
export { workspaceListItemSchema };
export const createWorkspaceBodySchema = createWorkspaceInputSchema.strict();
export const renameWorkspaceBodySchema = renameWorkspaceInputSchema.strict();
export const listWorkspaceFilesQuerySchema = z
  .object({
    path: z.string().optional(),
    query: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
  })
  .strict();
export const workspaceFilePathQuerySchema = z.object({ path: z.string().min(1) }).strict();
export const writeWorkspaceFileBodySchema = writeWorkspaceFileInputSchema.strict();
export const moveWorkspaceEntryBodySchema = moveWorkspaceEntryInputSchema.strict();
export { workspaceFileContentSchema, workspaceFileEntrySchema, workspaceFilesResponseSchema };

export const uploadStartupLogBodySchema = z.object({ content_base64: z.string() }).strict();
export const notFoundResponseSchema = z.object({ error: z.string() });
