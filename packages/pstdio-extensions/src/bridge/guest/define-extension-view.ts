import type { GuestHost, PropsStore } from "@pstdio/sdk/extensions";
import type { HostCapabilityRequest } from "../contract";
import { normalizeRuntimeError } from "../normalize-error";

export {
  defineExtensionView,
  type ExtensionViewModule,
  type ExtensionViewRender,
  type ExtensionViewRenderContext,
  type GuestHost,
  type PropsStore,
} from "@pstdio/sdk/extensions";

export const createGuestHost = (
  call: (request: HostCapabilityRequest) => Promise<unknown>,
  onEvent: GuestHost["onEvent"],
  extensionId?: string,
): GuestHost => ({
  call: async <TResult>(method: string, params?: unknown) => {
    try {
      return (await call({ method, params })) as TResult;
    } catch (error) {
      // RPC rejections cross the frame boundary as plain objects; hand guests a
      // real Error carrying the host's message (e.g. a capability denial).
      if (error instanceof Error) throw error;
      throw new Error(normalizeRuntimeError(error).message);
    }
  },
  onEvent,
  extensionId,
});

export const createPropsStore = <TProps>(initial: TProps): PropsStore<TProps> & { set: (next: TProps) => void } => {
  let value = initial;
  const listeners = new Set<(props: TProps) => void>();

  return {
    get: () => value,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next) => {
      value = next;
      for (const listener of listeners) listener(value);
    },
  };
};
