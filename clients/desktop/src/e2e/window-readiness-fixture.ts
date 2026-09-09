import { join } from "node:path";
import { app, protocol } from "electron";
import type { RuntimeDescriptor } from "pstdio/runtime";
import { LIFECYCLE_SCHEME } from "../windows/lifecycle-protocol";
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
  process.stdin.once("data", async () => {
    await controller.showLifecycle();
    console.log(JSON.stringify({ lifecycleVisible: controller.window.isVisible() }));
    await workbenchReady;
    process.stdout.write(
      `${JSON.stringify({ visible: controller.window.isVisible(), childViews: controller.window.contentView.children.length })}\n`,
      () => app.exit(0),
    );
  });
  console.log(
    JSON.stringify({
      visible: controller.window.isVisible(),
      childViews: controller.window.contentView.children.length,
    }),
  );
});
