import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { app, protocol } from "electron";
import type { RuntimeDescriptor } from "pstdio/runtime";
import { LIFECYCLE_SCHEME, readLifecycleAsset } from "../windows/lifecycle-protocol";
import { DesktopWindowController } from "../windows/window-controller";

protocol.registerSchemesAsPrivileged([
  { scheme: LIFECYCLE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

void app.whenReady().then(async () => {
  const controller = await DesktopWindowController.create(join(import.meta.dirname, "preload.cjs"), () => undefined);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const lifecycleProtocol = controller.window.webContents.session.protocol;
  lifecycleProtocol.unhandle(LIFECYCLE_SCHEME);
  lifecycleProtocol.handle(LIFECYCLE_SCHEME, async (request) => {
    entered.resolve();
    await release.promise;
    return readLifecycleAsset(request.url, join(import.meta.dirname, "renderer"), undefined);
  });
  const descriptor: RuntimeDescriptor = {
    schemaVersion: 1,
    protocolVersion: 1,
    pid: process.pid,
    instanceId: "stalled-runtime",
    ownerType: "persistent",
    origin: process.env.PSTDIO_WINDOW_TEST_ORIGIN as RuntimeDescriptor["origin"],
    token: "window-startup-abort-fixture",
    appVersion: app.getVersion(),
    startedAt: new Date().toISOString(),
  };
  let settled = false;
  let reason: string | undefined;
  const pending =
    process.env.PSTDIO_WINDOW_TEST_OPERATION === "prepare"
      ? controller.prepareWorkbench(descriptor, Promise.resolve())
      : controller.showWorkbench(descriptor);
  void pending.then(
    () => {
      settled = true;
    },
    (error: Error) => {
      settled = true;
      reason = error.message;
    },
  );
  const lifecycle = controller.showLifecycle();
  void lifecycle.catch(() => {});
  await entered.promise;
  process.send!({ pending: !settled, workbenchCreated: controller.window.contentView.children.length > 0 });
  process.once("message", async () => {
    const aborted = controller.abortWorkbenchStartup(new Error("Fixture runtime aborted"));
    await setImmediate();
    process.send!({ aborted, settled, reason, workbenchCreated: controller.window.contentView.children.length > 0 });
    process.once("message", async () => {
      const replacement = controller.showWorkbench({ ...descriptor, instanceId: "replacement-runtime" });
      release.resolve();
      await Promise.all([lifecycle, replacement]);
      process.send!({ replacementReady: true, workbenchCreated: controller.window.contentView.children.length > 0 });
    });
  });
});
