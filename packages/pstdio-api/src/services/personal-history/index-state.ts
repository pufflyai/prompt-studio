import { z } from "zod";

export const indexEntrySchema = z.object({
  kind: z.enum(["sessions", "workspaces", "workspace_sessions", "queues", "heads", "publications"]),
  id: z.string(),
  value: z.record(z.string(), z.unknown()).nullable(),
});
