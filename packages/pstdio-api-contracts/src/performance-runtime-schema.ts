import { z } from "zod";

const count = z.number().int().nonnegative().finite();
export const performanceRuntimeReadingSchema = z.object({
  pid: count,
  heapUsedBytes: count,
  externalBytes: count,
  counters: z.object({
    activeSessions: count,
    retainedMessages: count,
    subscribers: count,
    queuedEvents: count,
    queuedBytes: count,
    extensionImports: count,
  }),
});
