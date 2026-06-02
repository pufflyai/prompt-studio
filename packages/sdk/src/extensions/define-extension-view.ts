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

export interface WebviewFilesClient {
  pick(opts?: { accept?: string; multiple?: boolean }): Promise<File[]>;
  upload(input: {
    name: string;
    data: Uint8Array | ArrayBuffer;
    mimeType?: string;
    scope?: { type: string; id?: string };
  }): Promise<import("./types/webview-capabilities").ExtensionBlobRef>;
  list(input?: {
    scope?: { type: string; id?: string };
  }): Promise<import("./types/webview-capabilities").ExtensionBlobRef[]>;
  delete(id: string): Promise<void>;
}

export type ExtensionViewRenderContext<TProps = unknown> = {
  mount: HTMLElement;
  host: GuestHost;
  files: WebviewFilesClient;
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

const pickFiles = (opts: { accept?: string; multiple?: boolean } = {}) =>
  new Promise<File[]>((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = opts.accept ?? "";
    input.multiple = opts.multiple ?? false;
    input.style.display = "none";
    input.addEventListener("change", () => {
      const files = input.files ? Array.from(input.files) : [];
      input.remove();
      resolve(files);
    });
    input.addEventListener("cancel", () => {
      input.remove();
      resolve([]);
    });
    input.addEventListener("error", () => {
      input.remove();
      reject(new Error("Could not pick files."));
    });
    document.body.appendChild(input);
    input.click();
  });

const createFilesClient = (host: GuestHost): WebviewFilesClient => ({
  pick: pickFiles,
  upload: (input) => host.call("files.upload", input),
  list: async (input) => {
    const response = await host.call<{ files?: import("./types/webview-capabilities").ExtensionBlobRef[] }>(
      "files.list",
      input ?? {},
    );
    return response.files ?? [];
  },
  delete: (id) => host.call("files.delete", { id }),
});

export const defineExtensionView = <TProps = unknown>(definition: {
  render: ExtensionViewRender<TProps>;
}): ExtensionViewModule<TProps> => ({
  mount: async (mount, host, propsStore) => {
    const cleanup = await definition.render({ mount, host, files: createFilesClient(host), propsStore });
    return typeof cleanup === "function" ? cleanup : () => {};
  },
});
