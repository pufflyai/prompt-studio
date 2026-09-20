import type { DesktopRuntimeManager } from "../runtime/runtime-manager";
import type { DesktopWindowController } from "../windows/window-controller";

export const startWorkbench = async (
  window: Pick<DesktopWindowController, "showLifecycle" | "showWorkbench">,
  runtimeManager: Pick<DesktopRuntimeManager, "start">,
) => {
  const [, runtime] = await Promise.all([
    window.showLifecycle(),
    runtimeManager.start().then(async (runtime) => {
      await window.showWorkbench(runtime.descriptor);
      return runtime;
    }),
  ]);
  return runtime;
};
