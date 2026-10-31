import type {
  GuestHost,
  PropsStore,
  WebviewHostCapability,
  WebviewHostCapabilityParams,
  WebviewHostCapabilityResult,
  WebviewHostProps,
} from "@pstdio/sdk/extensions";
import type { HostCapabilityReply, HostCapabilityRequest } from "../contract";
import { normalizeRuntimeError } from "../normalize-error";

export type {
  ExtensionViewModule,
  ExtensionViewRender,
  ExtensionViewRenderContext,
  GuestHost,
  PropsStore,
} from "@pstdio/sdk/extensions";

export const createGuestHost = (
  call: (request: HostCapabilityRequest) => Promise<HostCapabilityReply>,
  onEvent: GuestHost["onEvent"],
  extensionId?: string,
  propsStore?: PropsStore<WebviewHostProps>,
): GuestHost => ({
  call: async <Capability extends WebviewHostCapability, Params extends WebviewHostCapabilityParams[Capability]>(
    method: Capability,
    ...args: Record<string, never> extends WebviewHostCapabilityParams[Capability]
      ? [params?: Params]
      : [params: Params]
  ) => {
    try {
      const reply = await call({ method, params: args[0] });
      if (!reply.ok) throw Object.assign(new Error(reply.error.message), reply.error);
      return reply.value as WebviewHostCapabilityResult<Capability, Params>;
    } catch (error) {
      // Transport failures can still arrive as plain objects.
      if (error instanceof Error) throw error;
      throw new Error(normalizeRuntimeError(error).message);
    }
  },
  onEvent,
  extensionId,
  propsStore,
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
