import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";

export const ownerSchema = z.strictObject({
  issuer: z.literal("https://accounts.google.com"),
  subject: identitySchema,
});
export const provisionSchema = z.strictObject({
  requestId: identitySchema,
  accountId: identitySchema,
  owner: ownerSchema,
});
export const registrationSchema = z.strictObject({
  requestId: identitySchema,
  accountId: identitySchema,
  workbenchId: identitySchema,
  environmentId: identitySchema,
  expiresAt: z.iso.datetime(),
});
export const grantSchema = registrationSchema.omit({ requestId: true }).extend({ id: identitySchema });
export const replacementSchema = registrationSchema.extend({ replacesId: identitySchema });
export const accountRequestSchema = z.strictObject({ requestId: identitySchema, accountId: identitySchema });
export const revokeSchema = accountRequestSchema.extend({ environmentId: identitySchema });
export const reconciliationSchema = accountRequestSchema.extend({
  owner: ownerSchema,
  state: z.enum(["active", "disabled"]),
});
export type ProvisionInput = z.input<typeof provisionSchema>;
export type RegistrationInput = z.input<typeof registrationSchema>;
export type ReplacementInput = z.input<typeof replacementSchema>;
export type AccountRequest = z.input<typeof accountRequestSchema>;
export type RevokeInput = z.input<typeof revokeSchema>;
export type ReconciliationInput = z.input<typeof reconciliationSchema>;
