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

/** Omit the team scope for legacy personal-account clients and services. */
export const accountScopedPath = (path: string, accountId?: string) =>
  accountId === undefined ? path : `${path}?accountId=${encodeURIComponent(identitySchema.parse(accountId))}`;

export const teamAccountSchema = z.strictObject({
  accountId: identitySchema,
  name: z.string(),
  role: z.enum(["owner", "member"]),
  features: z.strictObject({ relay: z.boolean() }),
});
export type TeamAccount = z.infer<typeof teamAccountSchema>;
