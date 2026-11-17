import type { DesktopRuntimeManager } from "../runtime/runtime-manager";
import type { DesktopWindowController } from "../windows/window-controller";

export const startWorkbench = async (
  window: Pick<DesktopWindowController, "showLifecycle" | "prepareWorkbench" | "showWorkbench">,
  runtimeManager: Pick<DesktopRuntimeManager, "start">,
) => {
  const [, runtime] = await Promise.all([
    window.showLifecycle(),
    runtimeManager
      .start((descriptor) => {
        // Preparation owns its failure; showing the prepared view observes it after API readiness.
        void window.prepareWorkbench(descriptor).catch(() => {});
      })
      .then(async (runtime) => {
        await window.showWorkbench(runtime.descriptor);
        return runtime;
      }),
  ]);
  return runtime;
};
