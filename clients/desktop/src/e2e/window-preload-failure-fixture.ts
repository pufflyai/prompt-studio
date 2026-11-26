import { join } from "node:path";
import { app, protocol } from "electron";
import type { RuntimeDescriptor } from "pstdio/runtime";
import { LIFECYCLE_SCHEME } from "../windows/lifecycle-protocol";
import { DesktopWindowController } from "../windows/window-controller";

protocol.registerSchemesAsPrivileged([
  { scheme: LIFECYCLE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

void app.whenReady().then(async () => {
  const controller = await DesktopWindowController.create(join(import.meta.dirname, "preload.cjs"), () => undefined);
  const descriptor: RuntimeDescriptor = {
    schemaVersion: 1,
    protocolVersion: 1,
    pid: process.pid,
    instanceId: "preload-failure-runtime",
    ownerType: "persistent",
    origin: process.env.PSTDIO_WINDOW_TEST_ORIGIN as RuntimeDescriptor["origin"],
    token: "window-preload-failure-fixture",
    appVersion: app.getVersion(),
    startedAt: new Date().toISOString(),
  };
  const startup = controller.prepareWorkbench(descriptor, Promise.resolve());
  void startup.then(
    () => process.send!({ rejected: false, workbenchCreated: controller.window.contentView.children.length > 0 }),
    (error: Error) =>
      process.send!({
        rejected: true,
        message: error.message,
        cause: error.cause instanceof Error ? error.cause.message : undefined,
        workbenchCreated: controller.window.contentView.children.length > 0,
      }),
  );
  void controller.showLifecycle().catch(() => {});
});
