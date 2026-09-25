import { join } from "node:path";
import { app, protocol } from "electron";
import type { RuntimeDescriptor } from "pstdio/runtime";
import { LIFECYCLE_SCHEME, readLifecycleAsset } from "../windows/lifecycle-protocol";
import { DesktopWindowController } from "../windows/window-controller";

protocol.registerSchemesAsPrivileged([
  { scheme: LIFECYCLE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

void app.whenReady().then(async () => {
  const controller = await DesktopWindowController.create(join(import.meta.dirname, "preload.cjs"));
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
    return readLifecycleAsset(request.url, join(import.meta.dirname, "renderer"));
  });
  controller.window.webContents.once("dom-ready", () => {
    process.send!({ documentReadyVisible: controller.window.isVisible() });
  });
  process.stdin.once("data", async () => {
    await controller.showLifecycle();
    process.send!({ lifecycleVisible: controller.window.isVisible() });
    await workbenchReady;
    app.focus({ steal: true });
    controller.window.focus();
    process.send!({
      visible: controller.window.isVisible(),
      workbenchVisible: controller.window.contentView.children.some((view) => view.getVisible()),
    });
    process.stdin.on("data", async () => {
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
