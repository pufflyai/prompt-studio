import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { IpcMain, IpcMainInvokeEvent, WebContents } from "electron";
import { DESKTOP_CHANNELS } from "../desktop-api";
import { registerPerformanceCaptureIpc } from "./performance-ipc";

test("a renderer crash releases only its capture owners including pending acquisition", async () => {
  const handlers = new Map<string, (event: IpcMainInvokeEvent, id: unknown) => Promise<void>>();
  const ipcMain = {
    handle: (channel: string, handler: never) => handlers.set(channel, handler),
    removeHandler: (channel: string) => handlers.delete(channel),
  } as unknown as IpcMain;
  const pending = Promise.withResolvers<() => Promise<void>>();
  let released = 0;
  const stop = registerPerformanceCaptureIpc({ ipcMain, assertSender: () => {}, retain: () => pending.promise });
  const sender = new EventEmitter() as unknown as WebContents;
  const event = { sender } as IpcMainInvokeEvent;
  const retaining = handlers.get(DESKTOP_CHANNELS.retainPerformanceCapture)!(event, "view");
  sender.emit("render-process-gone", {}, {});
  pending.resolve(async () => {
    released++;
  });
  await retaining;
  await Promise.resolve();
  expect(released).toBe(1);
  await handlers.get(DESKTOP_CHANNELS.releasePerformanceCapture)!(event, "view");
  expect(released).toBe(1);
  expect(sender.listenerCount("destroyed")).toBe(0);
  expect(sender.listenerCount("render-process-gone")).toBe(0);
  stop();
});
