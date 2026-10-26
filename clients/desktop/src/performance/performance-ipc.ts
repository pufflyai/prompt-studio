import type { IpcMain, IpcMainInvokeEvent, WebContents } from "electron";
import { DESKTOP_CHANNELS } from "../desktop-api";

/** Each trusted renderer owns its leases; a crashed renderer cannot retain a capture. */
export const registerPerformanceCaptureIpc = (input: {
  ipcMain: IpcMain;
  assertSender: (event: IpcMainInvokeEvent) => void;
  retain: () => Promise<() => Promise<void>>;
}) => {
  const owners = new Map<WebContents, { leases: Map<string, Promise<() => Promise<void>>>; cleanup: () => void }>();
  const releaseAll = (sender: WebContents) => {
    const owner = owners.get(sender);
    owners.delete(sender);
    owner?.cleanup();
    for (const lease of owner?.leases.values() ?? []) void lease.then((release) => release()).catch(() => {});
  };
  const validId = (value: unknown): value is string =>
    typeof value === "string" && value.length > 0 && value.length < 128;
  input.ipcMain.handle(DESKTOP_CHANNELS.retainPerformanceCapture, async (event, id: unknown) => {
    input.assertSender(event);
    if (!validId(id)) throw new Error("Invalid performance capture owner");
    let leases = owners.get(event.sender)?.leases;
    if (!leases) {
      leases = new Map();
      const release = () => releaseAll(event.sender);
      owners.set(event.sender, {
        leases,
        cleanup: () => {
          event.sender.removeListener("destroyed", release);
          event.sender.removeListener("render-process-gone", release);
        },
      });
      event.sender.once("destroyed", release);
      event.sender.once("render-process-gone", release);
    }
    if (leases.has(id)) return;
    const lease = input.retain();
    leases.set(id, lease);
    try {
      await lease;
    } catch (error) {
      leases.delete(id);
      throw error;
    }
  });
  input.ipcMain.handle(DESKTOP_CHANNELS.releasePerformanceCapture, async (event, id: unknown) => {
    input.assertSender(event);
    if (!validId(id)) throw new Error("Invalid performance capture owner");
    const leases = owners.get(event.sender)?.leases;
    const lease = leases?.get(id);
    leases?.delete(id);
    const release = await lease;
    await release?.();
  });
  return () => {
    for (const sender of owners.keys()) releaseAll(sender);
    input.ipcMain.removeHandler(DESKTOP_CHANNELS.retainPerformanceCapture);
    input.ipcMain.removeHandler(DESKTOP_CHANNELS.releasePerformanceCapture);
  };
};
