import { hostname } from "node:os";
import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { RouteDeps } from "../../features/deps";
import { managerRequest } from "./manager-client";
import type { createNativeStore, DeviceLogin } from "./native-store";

export interface DeviceReadIdentity {
  accountId: string;
  managerOrigin: string;
}
export const matchesDeviceAccount = (login: DeviceReadIdentity, expected: DeviceReadIdentity) =>
  login.accountId === expected.accountId && login.managerOrigin === expected.managerOrigin;
const devicesSchema = z.object({
  deviceId: identitySchema,
  devices: z.array(
    z.object({
      id: identitySchema,
      name: z.string(),
      platform: z.string(),
      createdAt: z.string(),
      lastSeenAt: z.string(),
      online: z.boolean(),
    }),
  ),
});

export const readDeviceLogin = async (
  store: ReturnType<typeof createNativeStore>,
  environment: Pick<RouteDeps["environmentService"], "get">,
  deviceId?: string,
) => {
  const login = await store.read();
  const environmentId = deviceId ?? (await environment.get()).environmentId;
  return login?.deviceId === environmentId ? login : null;
};

/** Expected account/origin is checked at native admission and again before returning private device data. */
export const createNativeDeviceReader =
  (input: {
    current(): Promise<DeviceLogin>;
    changed(): Error;
    call(
      path: string,
      body?: unknown,
      credential?: string,
      signal?: AbortSignal,
      expected?: DeviceReadIdentity,
    ): Promise<unknown>;
  }) =>
  async (signal?: AbortSignal, expected?: DeviceReadIdentity) => {
    signal?.throwIfAborted();
    const login = await input.current();
    if (expected && !matchesDeviceAccount(login, expected)) throw input.changed();
    const listed = devicesSchema.parse(
      await input.call("/v1/devices", undefined, login.token, signal, expected ?? login),
    );
    signal?.throwIfAborted();
    const current = await input.current();
    signal?.throwIfAborted();
    if (current.token !== login.token || !matchesDeviceAccount(current, login)) throw input.changed();
    return listed.devices.map((device) => ({ ...device, current: device.id === listed.deviceId }));
  };

const loginSchema = z.object({
  accountId: identitySchema,
  deviceId: identitySchema,
  token: z.string().min(1),
  relayOrigin: z.string(),
});

export const finalizeDeviceLogin = async (
  input: {
    store: ReturnType<typeof createNativeStore>;
    environment: Pick<RouteDeps["environmentService"], "get">;
    refresh(): Promise<void>;
  },
  origin: string,
  session: string,
  signal: AbortSignal,
  user: { email: string },
) => {
  const { environmentId } = await input.environment.get();
  const device = { deviceId: environmentId, name: hostname(), platform: process.platform };
  const login = loginSchema.parse(await managerRequest(origin, "/v1/device-login", session, device, signal));
  // The Google session is only needed to log in; the device credential replaces it.
  await managerRequest(origin, "/api/auth/sign-out", session, {}, signal).catch(() => {});
  signal.throwIfAborted();
  await input.store.save({ managerOrigin: origin, ...login, email: user.email });
  if (signal.aborted) {
    await input.store.forget(login.token);
    signal.throwIfAborted();
  }
  // Discovery starts after credential persistence so it cannot delay successful sign-in.
  void input.refresh();
};
