import { type ExtensionResourceCoordinator, extensionWorkCosts } from "../resource-policy";
import { prepareOwnerContext } from "./local-values";

export const createSupervisedFunctionWrapper = (owner: {
  sourcePath: string;
  cpuGroup: object;
  resources?: ExtensionResourceCoordinator;
  isLive: () => boolean;
  recover: (path: string[], args: unknown[]) => Promise<unknown>;
  signal: () => AbortSignal;
  awaitExit: () => Promise<void>;
  watchSignal: (signal: AbortSignal) => () => void;
}) => {
  const wrap = (value: unknown, path: string[] = []): unknown => {
    if (typeof value === "function")
      return async (...args: unknown[]) => {
        const context = args[0] as { signal?: AbortSignal } | undefined;
        const signal = context?.signal instanceof AbortSignal ? context.signal : undefined;
        signal?.throwIfAborted();
        if (!owner.isLive()) return owner.recover(path, args);
        const invoke = async () => {
          const cleanup = signal ? owner.watchSignal(signal) : () => {};
          try {
            const invocation =
              context && typeof context === "object"
                ? [prepareOwnerContext(context as Record<string, unknown>), ...args.slice(1)]
                : args;
            return await value(...invocation);
          } catch (error) {
            await owner.awaitExit();
            throw error;
          } finally {
            cleanup();
          }
        };
        return owner.resources
          ? owner.resources.run(
              owner.sourcePath,
              extensionWorkCosts.invocation,
              AbortSignal.any([owner.signal(), ...(signal ? [signal] : [])]),
              invoke,
              { priority: 2, bytes: 512 * 1024 + JSON.stringify(args.slice(1)).length * 2, cpuGroup: owner.cpuGroup },
            )
          : invoke();
      };
    if (Array.isArray(value)) return value.map((item, index) => wrap(item, [...path, String(index)]));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, wrap(item, [...path, key])]));
  };
  return wrap;
};
