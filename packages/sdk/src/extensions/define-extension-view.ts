/**
 * Guest-side contract for extension webviews. The host (dashboard) loads a small bridge
 * runtime in an iframe, applies theme variables onto the iframe document, then dynamically
 * imports the extension's bundled module and calls `view.mount(mount, host, propsStore)`.
 *
 * Extensions export `defineExtensionView({ render })` as the default export of their entry
 * module. `render` receives the mount element, an RPC handle for invoking host capabilities
 * (e.g. `host.call("commands.execute", …)`), and a subscribable `propsStore` that the host
 * can push updates into.
 */

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
