import type { createHookDispatcher, HookHandler } from "pstdio-hooks";
import type { LoadedPlugin } from "pstdio-plugins";

export const registerPluginHooks = (plugins: LoadedPlugin[], dispatcher: ReturnType<typeof createHookDispatcher>) => {
  for (const plugin of plugins) {
    for (const [hookName, handler] of Object.entries(plugin.definition.hooks ?? {})) {
      if (typeof handler !== "function") continue;
      dispatcher.register(hookName, handler as HookHandler);
    }
  }
};
