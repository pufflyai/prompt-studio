import { ManagerRequestDenied, managerRequest } from "./manager-client";
import { type DeviceReadIdentity, matchesDeviceAccount } from "./native-device-read";
import type { DeviceLogin } from "./native-store";

export const createNativeManagerCall =
  (input: {
    current(): Promise<DeviceLogin>;
    shutdown: AbortSignal;
    reject(credential: string): Promise<unknown>;
    refresh(): Promise<unknown>;
    changed(): Error;
    removed(): Error;
  }) =>
  async (path: string, body?: unknown, credential?: string, signal?: AbortSignal, expected?: DeviceReadIdentity) => {
    const login = await input.current();
    if (expected && !matchesDeviceAccount(login, expected)) throw input.changed();
    if (credential && login.token !== credential) throw new Error("Device login changed");
    try {
      const cancellation = AbortSignal.any([input.shutdown, ...(signal ? [signal] : [])]);
      return await managerRequest(login.managerOrigin, path, login.token, body, cancellation);
    } catch (error) {
      if (!(error instanceof ManagerRequestDenied && error.status === 401)) throw error;
      // Removing this owner drains its calls. Finish rejection before refresh waits for it.
      await input.reject(login.token);
      void input.refresh();
      throw input.removed();
    }
  };
