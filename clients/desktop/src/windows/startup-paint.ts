import type { WebContents } from "electron";
import { DESKTOP_CHANNELS } from "../desktop-api";
import { LIFECYCLE_URL } from "./lifecycle-protocol";

export const waitForStartupPaint = (contents: WebContents, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      contents.removeListener("ipc-message", painted);
      contents.removeListener("did-fail-load", failed);
      contents.removeListener("render-process-gone", crashed);
      contents.removeListener("destroyed", destroyed);
      signal.removeEventListener("abort", aborted);
      if (error) reject(error);
      else resolve();
    };
    const painted = (event: Electron.IpcMainEvent, channel: string) => {
      if (settled || channel !== DESKTOP_CHANNELS.startupPainted) return;
      const frame = event.senderFrame;
      if (frame !== contents.mainFrame || frame?.url !== LIFECYCLE_URL) return;
      finish();
    };
    const failed = (_event: unknown, code: number, description: string, _url: string, mainFrame: boolean) => {
      if (mainFrame) finish(new Error(`Startup document could not paint: ${description} (${code})`));
    };
    const crashed = () => finish(new Error("Startup renderer exited before its first contentful paint"));
    const destroyed = () => finish(new Error("Startup window closed before its first contentful paint"));
    const aborted = () => finish(signal.reason);
    contents.on("ipc-message", painted);
    contents.on("did-fail-load", failed);
    contents.on("render-process-gone", crashed);
    contents.on("destroyed", destroyed);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });

export const createStartupDocument = (contents: WebContents) => {
  const controller = new AbortController();
  const document = {
    painted: waitForStartupPaint(contents, controller.signal),
    load: undefined as Promise<void> | undefined,
    failed: false,
    close: () => controller.abort(new Error("Startup document was replaced before its first contentful paint")),
  };
  // Failure belongs to this navigation until an actual reload replaces it.
  void document.painted.catch(() => {
    document.failed = true;
  });
  return document;
};
