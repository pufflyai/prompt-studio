import type { DesktopRuntimeManager } from "../runtime/runtime-manager";
import type { DesktopWindowController } from "../windows/window-controller";

export const startWorkbench = async (
  window: Pick<DesktopWindowController, "showLifecycle" | "prepareWorkbench" | "showWorkbench">,
  runtimeManager: Pick<DesktopRuntimeManager, "start" | "cancelStart">,
) => {
  const preparationFailure = Promise.withResolvers<never>();
  try {
    const [, runtime] = await Promise.all([
      window.showLifecycle(),
      Promise.race([
        runtimeManager.start((descriptor) => {
          void window.prepareWorkbench(descriptor).catch((error: unknown) => {
            // Login/navigation can fail because the runtime itself is failing. Preserve its diagnosis.
            if (error instanceof Error && error.message.startsWith("workbench_unavailable:")) {
              preparationFailure.reject(error);
            }
          });
        }),
        preparationFailure.promise,
      ]).then(async (runtime) => {
        await window.showWorkbench(runtime.descriptor);
        return runtime;
      }),
    ]);
    return runtime;
  } catch (error) {
    // Recovery and Retry must wait for the failed readiness attempt and its child to stop.
    await runtimeManager.cancelStart();
    throw error;
  }
};
