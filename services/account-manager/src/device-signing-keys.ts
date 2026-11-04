import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { ManagerTransaction } from "./database";
import { DeviceAccessDenied } from "./renewal-errors";
import { devices } from "./schema";

const publicKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/)
  .refine((value) => Buffer.from(value, "base64url").toString("base64url") === value);
const activeDevice = (accountId: string, deviceId: string) =>
  and(eq(devices.accountId, accountId), eq(devices.id, deviceId), isNull(devices.removedAt));

export const readDeviceSigningKey = async (transaction: ManagerTransaction, accountId: string, deviceId: string) => {
  const [device] = await transaction
    .select({ publicKey: devices.signingKey })
    .from(devices)
    .where(activeDevice(accountId, deviceId));
  return device?.publicKey ? { publicKey: device.publicKey } : null;
};

// Only this device's credential can establish its key. A new login starts a new binding.
export const registerDeviceSigningKey = async (
  transaction: ManagerTransaction,
  device: { accountId: string; deviceId: string },
  value: unknown,
) => {
  const publicKey = publicKeySchema.parse(value);
  const current = await readDeviceSigningKey(transaction, device.accountId, device.deviceId);
  if (current && current.publicKey !== publicKey) throw new DeviceAccessDenied();
  await transaction
    .update(devices)
    .set({ signingKey: publicKey })
    .where(activeDevice(device.accountId, device.deviceId));
};
