import { z } from "zod";

export const extensionInstallationSchema = z.object({
  id: z.string(),
  installName: z.string(),
  extensionId: z.string().optional(),
  displayName: z.string(),
  projectId: z.string().optional(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  queuedAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  error: z.string().optional(),
});

export const extensionInstallationsSchema = z.array(extensionInstallationSchema);
export type ExtensionInstallation = z.infer<typeof extensionInstallationSchema>;
