import type { HostCapabilityRequest } from "../contract";

export type GuestHost = {
  call: <TResult = unknown>(method: string, params?: unknown) => Promise<TResult>;
};

export type PropsStore<TProps = unknown> = {
  get: () => TProps;
  subscribe: (listener: (props: TProps) => void) => () => void;
};

export type ExtensionViewRenderContext<TProps = unknown> = {
  mount: HTMLElement;
  host: GuestHost;
  propsStore: PropsStore<TProps>;
};

// biome-ignore-start lint/suspicious/noConfusingVoidType: render/mount may return void or a cleanup
export type ExtensionViewRender<TProps = unknown> = (
  context: ExtensionViewRenderContext<TProps>,
) => void | (() => void) | Promise<void | (() => void)>;

export type ExtensionViewModule<TProps = unknown> = {
  mount: (
    mount: HTMLElement,
    host: GuestHost,
    propsStore: PropsStore<TProps>,
  ) => Promise<() => void> | (() => void) | void;
};
// biome-ignore-end lint/suspicious/noConfusingVoidType: render/mount may return void or a cleanup

export const defineExtensionView = <TProps = unknown>(definition: {
  render: ExtensionViewRender<TProps>;
}): ExtensionViewModule<TProps> => ({
  mount: async (mount, host, propsStore) => {
    const cleanup = await definition.render({ mount, host, propsStore });
    return typeof cleanup === "function" ? cleanup : () => {};
  },
});

export const createGuestHost = (call: (request: HostCapabilityRequest) => Promise<unknown>): GuestHost => ({
  call: async <TResult>(method: string, params?: unknown) => (await call({ method, params })) as TResult,
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
