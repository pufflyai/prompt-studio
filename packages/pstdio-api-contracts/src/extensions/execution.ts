import { z } from "zod";

export const extensionExecutionSchema = z.object({
  available: z.boolean(),
  stopped: z.boolean(),
  owners: z.array(
    z.object({
      state: z.enum(["idle", "starting", "ready", "failed", "stopped"]),
      failureCode: z.string().optional(),
      pendingCalls: z.number().int().nonnegative(),
      resources: z
        .object({
          sampleIntervalMs: z.number().positive(),
          sampledAt: z.string().nullable(),
          windowMs: z.number().nonnegative().nullable(),
          cpuCores: z.number().nonnegative().nullable(),
          residentBytes: z.number().nonnegative().nullable(),
          processes: z.number().int().nonnegative(),
          observations: z.array(z.string()),
        })
        .optional(),
    }),
  ),
  affectedProjects: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type ExtensionExecution = z.infer<typeof extensionExecutionSchema>;
