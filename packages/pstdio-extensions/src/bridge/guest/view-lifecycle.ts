import type { ExtensionViewModule } from "./define-extension-view";

export const createViewLifecycle = <Input = void>(
  mount: (input: Input) => Promise<Awaited<ReturnType<ExtensionViewModule["mount"]>>>,
) => {
  let initialization: Promise<void> | undefined;
  let cleanup: (() => void) | undefined;
  let disposed = false;

  return {
    initialize: (input: Input) => {
      if (disposed) return Promise.resolve();
      // One browsing context owns one view, including while its module is loading.
      initialization ??= mount(input).then((result) => {
        if (typeof result !== "function") return;
        if (disposed) result();
        else cleanup = result;
      });
      return initialization;
    },
    dispose: () => {
      disposed = true;
      cleanup?.();
      cleanup = undefined;
    },
  };
};
