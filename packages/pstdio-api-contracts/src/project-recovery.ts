import { z } from "zod";

export const recoveryHoursSchema = z.union([z.literal(1), z.literal(12), z.literal(24)]);
export const projectSnapshotSchema = z.object({
  hours: recoveryHoursSchema,
  capturedAt: z.iso.datetime(),
  extensions: z.array(z.string()),
});
export const restoreProjectSchema = z
  .object({
    hours: recoveryHoursSchema,
    capturedAt: z.iso.datetime(),
    extensionId: z.string().min(1).optional(),
  })
  .strict();
export type ProjectSnapshot = z.infer<typeof projectSnapshotSchema>;
export type RestoreProjectInput = z.infer<typeof restoreProjectSchema>;
