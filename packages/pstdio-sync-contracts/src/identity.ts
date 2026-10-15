import { z } from "zod";
import { identitySchema } from "./wire";

export const environmentIdentitySchema = z.strictObject({ environmentId: identitySchema });
export const environmentTargetSchema = environmentIdentitySchema.extend({
  workbenchId: identitySchema,
  workspaceId: identitySchema,
});
export type EnvironmentIdentity = z.infer<typeof environmentIdentitySchema>;
export type EnvironmentTarget = z.infer<typeof environmentTargetSchema>;

// This is the relay ownership boundary, not the local dashboard's SSE table list.
// Publication and replication implementations must select workbench contributions
// explicitly; they must never copy arbitrary local database rows.
export const dataOwnership = {
  workbenchContent: "workbench",
  assets: "workbench",
  publishedExtensions: "workbench",
  automationDefinitions: "workbench",
  sessions: "environment",
  processes: "environment",
  workspaces: "environment",
  terminals: "environment",
  credentials: "environment",
  caches: "environment",
  developmentOverrides: "environment",
} as const;
