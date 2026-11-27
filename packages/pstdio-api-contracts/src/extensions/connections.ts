import { z } from "zod";
import { localizableStringSchema } from "./common";

export const workbenchExtensionConnectionRecordSchema = z.object({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
  label: localizableStringSchema,
  authType: z.enum(["bearer", "header", "oauth"]),
  supportsCheck: z.boolean(),
  scope: z.enum(["project", "global"]).optional(),
});

export const extensionConnectionRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  connectionId: z.string(),
  baseUrl: z.string(),
  authType: z.enum(["bearer", "header"]),
  configured: z.boolean(),
  scope: z.enum(["project", "global"]).optional(),
  lastCheck: z
    .object({
      ok: z.boolean(),
      status: z.number().int().nullable(),
      error: z.string().nullable(),
      checkedAt: z.string(),
    })
    .nullable(),
  updatedAt: z.string(),
});

export const configureExtensionConnectionSchema = z.object({
  baseUrl: z.url(),
  secret: z.string().optional(),
  credentialScope: z.enum(["all-projects", "project"]).optional(),
});

const extensionConnectionSignInScopeSchema = z.enum(["global", "shared"]);

export const deleteExtensionConnectionSchema = z
  .object({
    credentialScope: z.enum(["all-projects", "project"]).optional(),
    origin: z
      .url()
      .optional()
      .describe("Server origin for revoking a saved sign-in, even if its extension is unavailable."),
    signInScope: extensionConnectionSignInScopeSchema
      .optional()
      .describe("Saved sign-in to revoke at the given origin. Requires all-projects revocation."),
  })
  .strict();

const savedExtensionSignInSchema = z.object({
  extensionId: z.string(),
  connectionId: z.string(),
  origin: z.url(),
  signInScope: extensionConnectionSignInScopeSchema,
});

export const listExtensionConnectionsResponseSchema = z.object({
  connections: z.array(extensionConnectionRecordSchema),
  savedSignIns: z.array(savedExtensionSignInSchema).optional(),
});

export type ExtensionConnectionRecord = z.infer<typeof extensionConnectionRecordSchema>;
export type ConfigureExtensionConnectionInput = z.infer<typeof configureExtensionConnectionSchema>;
export type DeleteExtensionConnectionInput = z.infer<typeof deleteExtensionConnectionSchema>;
export type ExtensionConnectionSignInScope = z.infer<typeof extensionConnectionSignInScopeSchema>;
export type SavedExtensionSignIn = z.infer<typeof savedExtensionSignInSchema>;
export type ListExtensionConnectionsResponse = z.infer<typeof listExtensionConnectionsResponseSchema>;

export const extensionOAuthStatusSchema = z.discriminatedUnion("status", [
  z.object({ status: z.enum(["disconnected", "authorizing", "reconnect_required"]) }),
  z.object({
    status: z.literal("connected"),
    grantId: z.string(),
    scopes: z.array(z.string()),
    expiresAt: z.iso.datetime().nullable(),
  }),
]);
export const startExtensionOAuthResponseSchema = z.object({ authorizationUrl: z.url() });
export type StartExtensionOAuthResponse = z.infer<typeof startExtensionOAuthResponseSchema>;
