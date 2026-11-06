import { DeviceCommandInputError } from "pstdio-sync/relay";
import { apiLogger } from "../../lib/logger";
import { AccountRequestError } from "../account/native-account";
import { DeviceCommandAttachmentError } from "./device-command-attachments";
import type { startDeviceCommands } from "./device-commands";

export const createDeviceCommandCaller =
  (get: (id: string) => Pick<ReturnType<typeof startDeviceCommands>, "call"> | undefined) =>
  async (
    workbenchId: string,
    deviceId: string,
    command: Parameters<ReturnType<typeof startDeviceCommands>["call"]>[1],
    signal: AbortSignal,
  ) => {
    const target = get(workbenchId);
    if (!target) throw new AccountRequestError("This project is not connected to Cloud");
    try {
      return await target.call(deviceId, command, { signal });
    } catch (error) {
      apiLogger.warn(
        { event: "relay.device_command.failed", workbenchId, deviceId, err: error },
        "Device action failed",
      );
      if (error instanceof DeviceCommandInputError || error instanceof DeviceCommandAttachmentError)
        throw new AccountRequestError(error.message);
      throw new AccountRequestError("The device action is unavailable. Check that the device is online and signed in.");
    }
  };
