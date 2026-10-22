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
const fileSchema = z.strictObject({ login: deviceLoginSchema.nullable() });
export type DeviceLogin = z.infer<typeof deviceLoginSchema>;

export const createNativeStore = (path: string) => {
  const read = async () => (await readPrivateFile(path, fileSchema, { login: null })).login;
  return {
    read,
    save: (login: z.input<typeof deviceLoginSchema>) =>
      serializeNativeWrite(path, () => writePrivateFile(path, { login: deviceLoginSchema.parse(login) })),
    // Clears the login only while it still holds this credential, so a newer login is kept.
    forget: (token: string) =>
      serializeNativeWrite(path, async () => {
        if ((await read())?.token === token) await writePrivateFile(path, { login: null });
      }),
  };
};
