import { createDisposable } from "./disposable";
import { runWorkbenchEffect } from "./workbench-effect";

export const createWorkbenchEvent = <T>(name: string) => {
  const listeners = new Set<(value: T) => void>();
  return {
    notify(value: T) {
      for (const listener of listeners) runWorkbenchEffect(name, () => listener(value));
    },
    subscribe(listener: (value: T) => void) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
  };
};
