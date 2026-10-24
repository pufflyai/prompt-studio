import { z } from "zod";

export const recoveryHoursSchema = z.union([z.literal(1), z.literal(12), z.literal(24)]);
export const projectRecoveryPointSchema = z.object({
  /** The point's period: the last hour, 12 hours, or day. */
  hours: recoveryHoursSchema,
  /** When this device captured the point. */
  capturedAt: z.iso.datetime(),
  /** Extensions that can be restored on their own to this point. */
  extensions: z.array(z.string()),
});
export const restoreProjectSchema = z
  .object({
    hours: recoveryHoursSchema,
    /** The exact capture time from the list, so a replaced point is not restored by mistake. */
    capturedAt: z.iso.datetime(),
    /** Restore only this extension. Omit it to restore the whole project. */
    extensionId: z.string().min(1).optional(),
  })
  .strict();
export const restoreProjectResultSchema = z.object({
  /** Extensions whose data changed. */
  extensions: z.array(z.string()),
  /** Records written back, deleted, or changed. */
  records: z.number(),
});
export type ProjectRecoveryPoint = z.infer<typeof projectRecoveryPointSchema>;
export type RestoreProjectInput = z.infer<typeof restoreProjectSchema>;
export type RestoreProjectResult = z.infer<typeof restoreProjectResultSchema>;
