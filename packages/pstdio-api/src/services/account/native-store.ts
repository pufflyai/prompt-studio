import { createHash } from "node:crypto";
import { serviceAddress } from "pstdio-sync/relay";
import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { readPrivateFile, serializeNativeWrite, writePrivateFile } from "./private-file";

// The device credential stays in this private native file. Host API responses never include it.
export const deviceLoginSchema = z.strictObject({
  managerOrigin: z.string().transform(serviceAddress),
  relayOrigin: z.string().transform(serviceAddress),
  accountId: identitySchema,
  deviceId: identitySchema,
  token: z.string().min(1),
  email: z.string().optional(),
});
const fileSchema = z.strictObject({
  login: deviceLoginSchema.nullable(),
  rejected: z.object({ deviceId: identitySchema, credentialHash: z.string() }).optional(),
});
const credentialHash = (token: string) => createHash("sha256").update(token).digest("hex");
export type DeviceLogin = z.infer<typeof deviceLoginSchema>;

export const createNativeStore = (path: string) => {
  const readState = async () => readPrivateFile(path, fileSchema, { login: null });
  const read = async () => (await readState()).login;
  return {
    read,
    signInRequired: async (deviceId: string) => (await readState()).rejected?.deviceId === deviceId,
    save: (login: z.input<typeof deviceLoginSchema>) =>
      serializeNativeWrite(path, () => writePrivateFile(path, { login: deviceLoginSchema.parse(login) })),
    // Clears the login only while it still holds this credential, so a newer login is kept.
    forget: (token: string | null) =>
      serializeNativeWrite(path, async () => {
        const state = await readState();
        const sameLogin = (state.login?.token ?? null) === token;
        const sameRejection = token !== null && state.rejected?.credentialHash === credentialHash(token);
        if (sameLogin || sameRejection) await writePrivateFile(path, { login: null });
      }),
    reject: (token: string) =>
      serializeNativeWrite(path, async () => {
        const login = await read();
        if (login?.token === token)
          await writePrivateFile(path, {
            login: null,
            rejected: { deviceId: login.deviceId, credentialHash: credentialHash(token) },
          });
      }),
  };
};
