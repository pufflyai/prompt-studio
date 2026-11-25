import { z } from "zod";
import { addressSchema, environmentSchema } from "./io";

const device = z.object({
  credential: z.string().min(1),
  renewalGrant: z.string().min(1),
  deviceId: z.string().min(1),
});
export const probeConfigSchema = z
  .object({
    enabled: z.literal(true),
    dedicatedMonitoringAccount: z.literal(true),
    environment: environmentSchema,
    managerOrigin: addressSchema,
    relayOrigin: addressSchema,
    accountId: z.string().min(1),
    workbenchId: z.string().min(1),
    devices: z.tuple([device, device]),
    checkpointDirectory: z.string().min(1),
    budget: z.object({
      queryOrigin: addressSchema,
      readToken: z.string().min(32),
      accountAlias: z.literal("monitoring"),
      maximumBytes: z
        .number()
        .int()
        .positive()
        .max(100 * 1024 ** 2),
    }),
  })
  .strict()
  .refine(
    ({ devices: [a, b] }) =>
      a.deviceId !== b.deviceId && a.credential !== b.credential && a.renewalGrant !== b.renewalGrant,
    "Two independent devices are required",
  )
  .refine(
    (config) =>
      config.environment === "test" ||
      config.environment === "development" ||
      [config.managerOrigin, config.relayOrigin, config.budget.queryOrigin].every(
        (value) => new URL(value).protocol === "https:",
      ),
    "Production probes require HTTPS",
  );
export type ProbeConfig = z.infer<typeof probeConfigSchema>;
