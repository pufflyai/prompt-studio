import { z } from "zod";
import type { DeviceLogin } from "./native-store";

const issued = z.object({ grant: z.string(), expiresAt: z.string() });
export const createCloudEnrollment =
  (input: {
    current: () => Promise<DeviceLogin>;
    call: (path: string, body?: unknown, credential?: string) => Promise<unknown>;
  }) =>
  async (target: { deviceId: string; name: string }) => {
    const login = await input.current();
    const grant = issued.parse(
      await input.call("/v1/devices/enrollment", { ...target, platform: "linux" }, login.token),
    );
    return {
      ...grant,
      deviceId: target.deviceId,
      accountId: login.accountId,
      managerOrigin: login.managerOrigin,
      relayOrigin: login.relayOrigin,
    };
  };
