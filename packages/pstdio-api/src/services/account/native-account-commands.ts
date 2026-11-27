import type { DeviceCommand } from "pstdio-api-contracts";
import { identitySchema, type Json } from "pstdio-sync-contracts";
import type { RouteDeps } from "../../features/deps";
import type { ProjectSyncRetry } from "../relay/project-sync-retry";
import { AccountRequestError } from "./account-errors";
import { createNativeDeviceReader } from "./native-device-read";
import type { createNativeLogout } from "./native-logout";
import type { createNativeManagerCall } from "./native-manager-call";
import type { DeviceLogin } from "./native-store";

export type SendDeviceCommand = (
  projectId: string,
  deviceId: string,
  command: DeviceCommand,
  signal: AbortSignal,
) => Promise<Json>;
export const createDeviceCommandSender = () => {
  let send: SendDeviceCommand = async () => {
    throw new AccountRequestError("This project is not connected to Cloud");
  };
  return {
    send: (...args: Parameters<SendDeviceCommand>) => send(...args),
    connect: (next: SendDeviceCommand) => {
      send = next;
    },
  };
};
export const retryProjectSync = async (
  projectId: string,
  projects: Pick<RouteDeps["projectService"], "get">,
  refresh: () => Promise<void>,
  retry: ProjectSyncRetry,
  sourceId?: string,
) => {
  if (!(await projects.get(projectId))) throw new AccountRequestError("Unknown project");
  await refresh();
  await retry(projectId, sourceId);
  return { ok: true };
};

export const createAccountPoller = (refresh: () => void, interval: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    clear: () => clearTimeout(timer),
    schedule: () => {
      timer = setTimeout(refresh, interval);
      timer.unref?.();
    },
  };
};
export const createNativeDeviceActions = (input: {
  current: () => Promise<DeviceLogin>;
  call: ReturnType<typeof createNativeManagerCall>;
  logout: ReturnType<typeof createNativeLogout>;
}) => {
  const devicePath = (id: string) => `/v1/devices/${encodeURIComponent(identitySchema.parse(id))}`;
  return {
    devices: createNativeDeviceReader({
      current: input.current,
      call: input.call,
      changed: () => new AccountRequestError("The account changed before the device read completed"),
    }),
    renameDevice: (id: string, name: string) =>
      input.call(`${devicePath(id)}/rename`, { name }).then(() => ({ ok: true })),
    async removeDevice(id: string) {
      const login = await input.current();
      if (id === login.deviceId) return input.logout();
      await input.call(`${devicePath(id)}/remove`, {});
      return { ok: true };
    },
  };
};
