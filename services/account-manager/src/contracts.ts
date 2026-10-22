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
export const deviceNameSchema = z.string().trim().min(1).max(100);
export const deviceProfileSchema = z.strictObject({
  deviceId: identitySchema,
  name: deviceNameSchema,
  platform: z.string().trim().min(1).max(40),
});
export const deviceRegistrationSchema = deviceProfileSchema.extend({ accountId: identitySchema });
export const deviceSchema = z.strictObject({ accountId: identitySchema, deviceId: identitySchema });
export const workbenchSchema = z.strictObject({ accountId: identitySchema, workbenchId: identitySchema });
export const accountRequestSchema = z.strictObject({ requestId: identitySchema, accountId: identitySchema });
export const reconciliationSchema = accountRequestSchema.extend({
  owner: ownerSchema,
  state: z.enum(["active", "disabled"]),
});
export type ProvisionInput = z.input<typeof provisionSchema>;
export type DeviceRegistrationInput = z.input<typeof deviceRegistrationSchema>;
export type DeviceInput = z.input<typeof deviceSchema>;
export type WorkbenchInput = z.input<typeof workbenchSchema>;
export type AccountRequest = z.input<typeof accountRequestSchema>;
export type ReconciliationInput = z.input<typeof reconciliationSchema>;
