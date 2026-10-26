import { type ExtensionResourceCoordinator, extensionWorkCosts } from "../resource-policy";
import { prepareOwnerContext } from "./local-values";
import { retainOwnerResult } from "./result-lifetime";

const prepareInvocation = (context: unknown, args: unknown[]) =>
  context && typeof context === "object"
    ? [prepareOwnerContext(context as Record<string, unknown>), ...args.slice(1)]
    : args;

interface SupervisedOwner {
  sourcePath: string;
  cpuGroup: object;
  resources?: ExtensionResourceCoordinator;
  isLive: () => boolean;
  generation: () => number;
  recover: (path: string[], args: unknown[]) => Promise<unknown>;
  signal: () => AbortSignal;
  awaitExit: () => Promise<void>;
  watchSignal: (signal: AbortSignal) => () => void;
}

const invokeOwnerFunction = async (
  owner: SupervisedOwner,
  value: (...args: unknown[]) => unknown,
  args: unknown[],
  signal?: AbortSignal,
) => {
  const cleanup = signal ? owner.watchSignal(signal) : () => {};
  let retained = false;
  try {
    const result = await value(...args);
    retained = retainOwnerResult(result, cleanup);
    return result;
  } catch (error) {
    // Ordinary extension errors leave the process live. Reaping is only
    // required when supervision interrupted this invocation's process.
    if (!owner.isLive()) await owner.awaitExit();
    throw error;
  } finally {
    if (!retained) cleanup();
  }
};

export const createSupervisedFunctionWrapper = (owner: SupervisedOwner) => {
  const wrap = (value: unknown, path: string[] = []): unknown => {
    if (typeof value === "function") {
      const generation = owner.generation();
      return async (...args: unknown[]) => {
        const context = args[0] as { signal?: AbortSignal; projectId?: string } | undefined;
        const signal = context?.signal instanceof AbortSignal ? context.signal : undefined;
        signal?.throwIfAborted();
        if (!owner.isLive() || owner.generation() !== generation) return owner.recover(path, args);
        const invocation = prepareInvocation(context, args);
        const invoke = () => invokeOwnerFunction(owner, value as (...args: unknown[]) => unknown, invocation, signal);
        return owner.resources
          ? owner.resources.run(
              owner.sourcePath,
              extensionWorkCosts.invocation,
              AbortSignal.any([owner.signal(), ...(signal ? [signal] : [])]),
              invoke,
              {
                priority: 2,
                bytes: 512 * 1024 + JSON.stringify(args.slice(1)).length * 2,
                cpuGroup: owner.cpuGroup,
                projectId: context?.projectId,
              },
            )
          : invoke();
      };
    }
    if (Array.isArray(value)) return value.map((item, index) => wrap(item, [...path, String(index)]));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, wrap(item, [...path, key])]));
  };
  return wrap;
};
