import { rm } from "node:fs/promises";
import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { ManagerRequestDenied, managerOriginSchema, managerRequest } from "./manager-client";
import { createNativeStore, type DeviceLogin } from "./native-store";
import { readPrivateFile } from "./private-file";

const envelopeSchema = z.strictObject({
  managerOrigin: managerOriginSchema,
  relayOrigin: managerOriginSchema,
  accountId: identitySchema,
  deviceId: identitySchema,
  grant: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  expiresAt: z.iso.datetime(),
});

export const readCloudBootstrap = async (file?: string) => {
  if (!file) return undefined;
  const envelope = await readPrivateFile(file, envelopeSchema.nullable(), null);
  return envelope ? { ...envelope, file } : undefined;
};
const sameIdentity = (login: DeviceLogin, envelope: z.infer<typeof envelopeSchema>) =>
  login.deviceId === envelope.deviceId &&
  login.accountId === envelope.accountId &&
  login.managerOrigin === envelope.managerOrigin &&
  login.relayOrigin === envelope.relayOrigin;

// Persist the target-generated credential before exchanging a one-use grant. If the
// response is lost after the manager commits, that credential confirms enrollment on restart.
export const bootstrapCloudDevice = async (
  envelope: NonNullable<Awaited<ReturnType<typeof readCloudBootstrap>>>,
  accountFile: string,
) => {
  const store = createNativeStore(accountFile);
  const pendingFile = `${accountFile}.cloud-pending`;
  const existing = await store.read();
  if (existing && !sameIdentity(existing, envelope)) throw new Error("This runtime home belongs to another device");
  if (!existing) {
    const pending = createNativeStore(pendingFile);
    let login = await pending.read();
    if (login && !sameIdentity(login, envelope)) throw new Error("This runtime home belongs to another device");
    if (!login) {
      login = {
        managerOrigin: envelope.managerOrigin,
        relayOrigin: envelope.relayOrigin,
        accountId: envelope.accountId,
        deviceId: envelope.deviceId,
        token: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"),
      };
      await pending.save(login);
    }
    let response: unknown;
    try {
      response = await managerRequest(login.managerOrigin, "/v1/devices", login.token);
    } catch (error) {
      if (!(error instanceof ManagerRequestDenied) || error.status !== 401) throw error;
      response = await managerRequest(login.managerOrigin, "/v1/devices/enrollment/consume", envelope.grant, {
        deviceId: login.deviceId,
        token: login.token,
      });
    }
    const enrolled = z.object({ accountId: identitySchema, deviceId: identitySchema }).parse(response);
    if (enrolled.accountId !== login.accountId || enrolled.deviceId !== login.deviceId)
      throw new Error("Cloud enrollment returned another device");
    await store.save(login);
  }
  await Promise.all([rm(envelope.file, { force: true }), rm(pendingFile, { force: true })]);
};
