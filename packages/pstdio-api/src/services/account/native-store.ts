import { relayOrigin } from "pstdio-sync/relay";
import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { managerOriginSchema } from "./manager-client";
import { readPrivateFile, serializeNativeWrite, writePrivateFile } from "./private-file";

// The device credential stays in this private native file. Host API responses never include it.
export const deviceLoginSchema = z.strictObject({
  managerOrigin: managerOriginSchema,
  relayOrigin: z.string().transform(relayOrigin),
  accountId: identitySchema,
  deviceId: identitySchema,
  token: z.string().min(1),
});
const fileSchema = z.strictObject({ login: deviceLoginSchema.nullable() });
export type DeviceLogin = z.infer<typeof deviceLoginSchema>;

export const createNativeStore = (path: string) => ({
  read: async () => (await readPrivateFile(path, fileSchema, { login: null })).login,
  save: (login: DeviceLogin | null) => serializeNativeWrite(path, () => writePrivateFile(path, { login })),
});
