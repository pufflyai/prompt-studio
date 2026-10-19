import { relayOrigin } from "pstdio-sync/relay";
import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";

export const workbenchSchema = z.strictObject({
  accountId: identitySchema,
  workbenchId: identitySchema,
  environmentId: identitySchema,
  relayOrigin: z.string().transform(relayOrigin),
  managerOrigin: z.string().transform(relayOrigin),
  renewalGrant: z.string().min(1),
});
export const configSchema = z.strictObject({ connections: z.array(workbenchSchema) });
export type RelayWorkbench = z.infer<typeof workbenchSchema>;
