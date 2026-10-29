import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { createDesktopCapture } from "../performance/create-performance-capture";

void app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false });
  await window.loadURL("data:text/html,<h1>Performance capture fixture</h1>");
  let capture: ReturnType<typeof createDesktopCapture> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  process.on("message", async (command) => {
    try {
      if (command === "capture") {
        capture = createDesktopCapture({
          backend: () => ({
            id: "fixture",
            scope: "local",
            pid: Number(process.env.PSTDIO_CAPTURE_PID),
            origin: process.env.PSTDIO_CAPTURE_ORIGIN!,
            token: "fixture-token",
          }),
          executable: process.env.PSTDIO_CAPTURE_OBSERVER!,
          recordingDirectory: join(app.getPath("userData"), "recordings"),
          hostVersion: "fixture",
          onError: (error) => process.send?.({ kind: "error", error: String(error) }),
        });
        await capture.sample(() => []);
        timer = setInterval(() => void capture?.sample(() => []), 2000);
        process.send?.({ kind: "capture", snapshot: capture.snapshot() });
      } else if (command === "ping") {
        process.send?.({ kind: "heartbeat", at: Date.now() });
      } else if (command === "sample") {
        await capture?.sample(() => []);
        process.send?.({ kind: "sample", snapshot: capture?.snapshot() });
      } else if (command === "stop") {
        clearInterval(timer);
        await capture?.close();
        process.send?.({ kind: "stopped" });
      }
    } catch (error) {
      process.send?.({ kind: "error", error: String(error) });
    }
  });
  process.send?.({ kind: "ready" });
});
