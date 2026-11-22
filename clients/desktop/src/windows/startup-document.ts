import type { WebContents } from "electron";
import { LIFECYCLE_URL } from "./lifecycle-protocol";

export const waitForStartupDom = (contents: WebContents, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      contents.removeListener("dom-ready", ready);
      contents.removeListener("did-fail-load", failed);
      contents.removeListener("render-process-gone", crashed);
      contents.removeListener("destroyed", destroyed);
      signal.removeEventListener("abort", aborted);
      if (error) reject(error);
      else resolve();
    };
    const ready = () => {
      if (contents.getURL() === LIFECYCLE_URL) finish();
    };
    const failed = (_event: unknown, code: number, description: string, _url: string, mainFrame: boolean) => {
      if (mainFrame) finish(new Error(`Startup document could not load: ${description} (${code})`));
    };
    const crashed = () => finish(new Error("Startup renderer exited before its document was ready"));
    const destroyed = () => finish(new Error("Startup window closed before its document was ready"));
    const aborted = () => finish(signal.reason);
    contents.on("dom-ready", ready);
    contents.on("did-fail-load", failed);
    contents.on("render-process-gone", crashed);
    contents.on("destroyed", destroyed);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });

export const createStartupDocument = (contents: WebContents) => {
  const controller = new AbortController();
  const document = {
    ready: waitForStartupDom(contents, controller.signal),
    load: undefined as Promise<void> | undefined,
    failed: false,
    close: () => controller.abort(new Error("Startup document was replaced before its document was ready")),
  };
  // Failure belongs to this navigation until an actual reload replaces it.
  void document.ready.catch(() => {
    document.failed = true;
  });
  return document;
};
