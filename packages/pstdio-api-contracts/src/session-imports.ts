import { z } from "zod";

export const sessionImportSourceSchema = z
  .object({
    sourcePath: z.string().min(1),
    storagePath: z.string().min(1).optional(),
    projectMap: z.record(z.string(), z.string().min(1)).default({}),
  })
  .strict();
export const sessionImportErrorSchema = z.object({
  line: z.number().int().positive(),
  sessionId: z.string().optional(),
  error: z.string(),
});
export const sessionImportPreviewSchema = z.object({
  sourcePath: z.string(),
  fingerprint: z.string(),
  total: z.number(),
  ready: z.number(),
  duplicates: z.number(),
  failed: z.number(),
  excluded: z.number(),
  projects: z.array(
    z.object({
      sourceProjectId: z.string(),
      name: z.string(),
      sessions: z.number(),
      targetProjectId: z.string().optional(),
    }),
  ),
  errors: z.array(sessionImportErrorSchema),
});
export const sessionImportJobSchema = z.object({
  id: z.string().uuid(),
  source: sessionImportSourceSchema,
  fingerprint: z.string().nullable(),
  status: z.enum(["running", "paused", "completed", "failed"]),
  phase: z.enum(["preparing", "importing"]),
  indexedFiles: z.number().int().nonnegative(),
  attempt: z.number().int().positive(),
  cursor: z.number().int().nonnegative(),
  processed: z.number(),
  imported: z.number(),
  skipped: z.number(),
  failed: z.number(),
  excluded: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  error: z.string().optional(),
});
export const sessionImportErrorsSchema = z.object({
  errors: z.array(sessionImportErrorSchema),
  nextOffset: z.number().int().nonnegative().nullable(),
});
export type SessionImportSource = z.input<typeof sessionImportSourceSchema>;
export type SessionImportPreview = z.infer<typeof sessionImportPreviewSchema>;
export type SessionImportJob = z.infer<typeof sessionImportJobSchema>;
export type SessionImportError = z.infer<typeof sessionImportErrorSchema>;
export type SessionImportErrors = z.infer<typeof sessionImportErrorsSchema>;
