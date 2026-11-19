import { z } from "zod";

export const resourcePresentationRecordSchema = z.object({
  extensionId: z.string(),
  resourceKind: z.object({ extensionId: z.string(), kind: z.literal("resource-kind"), id: z.string() }),
  resolveCommand: z.string(),
  refreshEvents: z.array(z.string()),
});
