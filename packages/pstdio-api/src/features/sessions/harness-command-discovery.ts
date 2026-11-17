import { z } from "@hono/zod-openapi";
import { harnessCommandStateSchema } from "pstdio-api-contracts";

export const harnessCommandDiscoverySchema = harnessCommandStateSchema.extend({
  harnessId: z.string(),
  unavailableReason: z.string().optional(),
});
export type HarnessCommandDiscovery = z.infer<typeof harnessCommandDiscoverySchema>;

export const unavailableWorkspaceCommands = (harnessId: string): HarnessCommandDiscovery => ({
  harnessId,
  commands: [],
  modes: [],
  // Older clients still recognize slash input as a native operation and hit the workspace guard.
  slashCommands: true,
  unavailableReason: "Workspace commands are unavailable. Check its setup before retrying.",
});
