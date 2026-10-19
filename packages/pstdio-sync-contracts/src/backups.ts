import { z } from "zod";
import { coverageAckSchema } from "./checkpoint";
import { captureSchema } from "./production-coverage";
import { assetSchema, identitySchema, scopeSchema } from "./wire";

export const relayBackupHour = 60 * 60 * 1000;
export const backupHandleSchema = z.strictObject({
  key: identitySchema,
  asset: assetSchema,
  capturedAt: z.number().int().nonnegative(),
});
export const relayBackupScopeSchema = z.strictObject({
  protocolVersion: z.literal(2),
  capture: captureSchema,
  coverage: z.array(coverageAckSchema),
});
export const relayBackupCompletionSchema = z.strictObject({
  protocolVersion: z.literal(2),
  capturedAt: z.number().int().nonnegative(),
  manifests: z.array(z.strictObject({ scope: scopeSchema, asset: assetSchema })),
});
export const relayBackupStatusSchema = z.strictObject({
  protocolVersion: z.literal(2),
  attempt: z
    .strictObject({
      id: identitySchema,
      startedAt: z.number().int().nonnegative(),
      finishedAt: z.number().int().nonnegative().nullable(),
      error: z.string().nullable(),
    })
    .nullable(),
  latest: backupHandleSchema.nullable(),
});
export type RelayBackupHandle = z.infer<typeof backupHandleSchema>;
export type RelayBackupStatus = z.infer<typeof relayBackupStatusSchema>;
export type RelayBackupScope = z.infer<typeof relayBackupScopeSchema>;
