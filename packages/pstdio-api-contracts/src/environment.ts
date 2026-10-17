import { environmentIdentitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { initialWorkspaceSchema } from "./projects";
import { workspaceSchema } from "./workspaces";

export type { EnvironmentIdentity, EnvironmentTarget } from "pstdio-sync-contracts";
export { environmentIdentitySchema, environmentTargetSchema } from "pstdio-sync-contracts";

export const bindEnvironmentInputSchema = environmentIdentitySchema.extend({
  name: z.string().trim().min(1),
  initial_workspace: initialWorkspaceSchema,
});
export const environmentBindingSchema = environmentIdentitySchema.extend({
  workbenchId: z.string().min(1),
  workspace: workspaceSchema,
});
export type BindEnvironmentInput = z.infer<typeof bindEnvironmentInputSchema>;
export type EnvironmentBinding = z.infer<typeof environmentBindingSchema>;
