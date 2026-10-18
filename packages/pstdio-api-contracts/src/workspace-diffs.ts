import { z } from "zod";

export const fileDiffSchema = z.object({
  filePath: z.string(),
  change: z.enum(["added", "deleted", "modified", "renamed", "copied", "permissionChange"]),
  additions: z.number(),
  deletions: z.number(),
  oldContent: z.string(),
  newContent: z.string(),
  oldPath: z.string().optional(),
  newPath: z.string().optional(),
});

export const fileDiffSummarySchema = fileDiffSchema.omit({ oldContent: true, newContent: true });

export const workspaceDiffResponseSchema = z.object({
  workspace_id: z.string(),
  base_ref: z.string(),
  head_ref: z.string(),
  files: z.array(fileDiffSchema),
  totals: z.object({
    additions: z.number(),
    deletions: z.number(),
    file_count: z.number(),
  }),
});

export const workspaceDiffFilesResponseSchema = workspaceDiffResponseSchema.extend({
  files: z.array(fileDiffSummarySchema),
});

export type WorkspaceDiffFile = z.infer<typeof fileDiffSchema>;
export type WorkspaceDiffFiles = z.infer<typeof workspaceDiffFilesResponseSchema>;

export const workspaceDiffSummarySchema = z.object({
  workspace_id: z.string(),
  additions: z.number(),
  deletions: z.number(),
  file_count: z.number(),
});

export type WorkspaceDiffSummary = z.infer<typeof workspaceDiffSummarySchema>;
