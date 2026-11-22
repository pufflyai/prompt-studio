import type { DesktopRuntimeManager } from "../runtime/runtime-manager";
import type { DesktopWindowController } from "../windows/window-controller";

export const startWorkbench = async (
  window: Pick<DesktopWindowController, "showLifecycle" | "prepareWorkbench" | "showWorkbench">,
  runtimeManager: Pick<DesktopRuntimeManager, "start" | "cancelStart">,
) => {
  const preparationFailure = Promise.withResolvers<never>();
  let readiness: ReturnType<typeof runtimeManager.start> | undefined;
  try {
    const lifecycle = window.showLifecycle();
    readiness = runtimeManager.start((descriptor) => {
      void window.prepareWorkbench(descriptor).catch((error: unknown) => {
        // Login/navigation can fail because the runtime itself is failing. Preserve its diagnosis.
        if (error instanceof Error && error.message.startsWith("workbench_unavailable:")) {
          preparationFailure.reject(error);
        }
      });
    });
    const [, runtime] = await Promise.all([
      lifecycle,
      Promise.race([readiness, preparationFailure.promise]).then(async (runtime) => {
        await window.showWorkbench(runtime.descriptor);
        return runtime;
      }),
    ]);
    return runtime;
  } catch (error) {
    // Recovery and Retry must wait for the failed readiness attempt and its child to stop.
    await runtimeManager.cancelStart();
    if (error instanceof Error && error.message.startsWith("workbench_unavailable:")) {
      const failure = await readiness?.catch((failure: unknown) => failure);
      // A failed runtime can close asset requests before its diagnosis reaches readiness.
      // Prefer an explicit runtime diagnosis; cancellation alone must not replace the renderer error.
      if (
        failure instanceof Error &&
        /^(?:port_bind_failure|pglite_ownership_conflict|pglite_recovery_failure): /.test(failure.message)
      )
        throw failure;
    }
    throw error;
  }
};
