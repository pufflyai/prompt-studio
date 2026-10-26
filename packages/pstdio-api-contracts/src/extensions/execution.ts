import { z } from "zod";

export const extensionExecutionSchema = z.object({
  available: z.boolean(),
  stopped: z.boolean(),
  owners: z.array(
    z.object({
      state: z.enum(["idle", "starting", "ready", "failed", "stopped"]),
      failureCode: z.string().optional(),
      pendingCalls: z.number().int().nonnegative(),
    }),
  ),
  affectedProjects: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type ExtensionExecution = z.infer<typeof extensionExecutionSchema>;
