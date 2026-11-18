import { deviceAutomationsOwnerId } from "../../features/extensions/device-automations";
import { startCoreRecordSync } from "./core-records";
export const startAutomationSync = (input: Omit<Parameters<typeof startCoreRecordSync>[0], "ownerId">) =>
  startCoreRecordSync({ ...input, ownerId: deviceAutomationsOwnerId });
