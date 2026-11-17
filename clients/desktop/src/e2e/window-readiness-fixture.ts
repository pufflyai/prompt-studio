import { once } from "node:events";
import { join } from "node:path";
import { app, protocol } from "electron";
import type { RuntimeDescriptor } from "pstdio/runtime";
import { LIFECYCLE_SCHEME, readLifecycleAsset } from "../windows/lifecycle-protocol";
import { DesktopWindowController } from "../windows/window-controller";

protocol.registerSchemesAsPrivileged([
  { scheme: LIFECYCLE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

void app.whenReady().then(async () => {
  const controller = await DesktopWindowController.create(join(import.meta.dirname, "preload.cjs"), () => undefined);
  controller.window.webContents.on("ipc-message", (_event, channel) => {
    if (channel === "fixture:paint-ready") process.send!({ paintReady: true });
  });
  process.on("message", (message) => {
    if (message === "release-paint") controller.window.webContents.send("fixture:release-paint");
  });
  const descriptor: RuntimeDescriptor = {
    schemaVersion: 1,
    protocolVersion: 1,
    pid: process.pid,
    instanceId: "window-readiness",
    ownerType: "persistent",
    origin: process.env.PSTDIO_WINDOW_TEST_ORIGIN as RuntimeDescriptor["origin"],
    token: "window-readiness-secret",
    appVersion: app.getVersion(),
    startedAt: new Date().toISOString(),
  };
  const workbenchReady = controller.showWorkbench(descriptor);
  const lifecycleProtocol = controller.window.webContents.session.protocol;
  lifecycleProtocol.unhandle(LIFECYCLE_SCHEME);
  lifecycleProtocol.handle(LIFECYCLE_SCHEME, async (request) => {
    if (new URL(request.url).pathname === "/pending.png") {
      // Finish loading the lifecycle document after the workbench takes focus.
      await workbenchReady;
      return new Response(null, { status: 404 });
    }
    return readLifecycleAsset(request.url, join(import.meta.dirname, "renderer"), undefined);
  });
  controller.window.webContents.once("dom-ready", () => {
    process.send!({ documentReadyVisible: controller.window.isVisible() });
  });
  process.once("message", async () => {
    await controller.showLifecycle();
    process.send!({ lifecycleVisible: controller.window.isVisible() });
    await workbenchReady;
    app.focus({ steal: true });
    controller.window.focus();
    process.send!({
      visible: controller.window.isVisible(),
      workbenchVisible: controller.window.contentView.children.some((view) => view.getVisible()),
    });
    process.on("message", async (message) => {
      if (message === "release-paint") return;
      if (message === "reload-lifecycle") {
        const gone = once(controller.window.webContents, "render-process-gone");
        controller.window.webContents.forcefullyCrashRenderer();
        await gone;
        const lifecycle = controller.showLifecycle();
        const workbench = controller.showWorkbench({ ...descriptor, instanceId: "reloaded-lifecycle" });
        await Promise.all([lifecycle, workbench]);
        process.send!({ lifecycleReloaded: true });
        return;
      }
      if (message === "background-recovery") {
        // A covered lifecycle renderer is throttled after the desktop loses focus.
        controller.window.webContents.setBackgroundThrottling(true);
        await controller.showLifecycle();
        process.send!({ lifecycleThrottled: controller.window.webContents.getBackgroundThrottling() });
        return;
      }
      if (typeof message === "string" && message.startsWith("recovery-")) {
        const window = controller.window;
        switch (message) {
          case "recovery-hide":
            window.hide();
            await controller.showLifecycle();
            break;
          case "recovery-show":
            window.show();
            window.blur();
            await controller.showLifecycle();
            break;
          case "recovery-minimize":
            window.minimize();
            break;
          case "recovery-restore":
            window.restore();
            break;
        }
        process.send!({
          visible: window.isVisible(),
          minimized: window.isMinimized(),
          throttled: window.webContents.getBackgroundThrottling(),
        });
        return;
      }
      const workbenchFocused = await controller.webContents()[1]?.executeJavaScript("document.hasFocus()");
      process.send!({ workbenchFocused });
    });
  });
  process.send!({
    visible: controller.window.isVisible(),
    workbenchVisible: controller.window.contentView.children.some((view) => view.getVisible()),
    workbenchCreated: controller.window.contentView.children.length > 0,
  });
});
