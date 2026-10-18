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

import type { WebviewHostProps } from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./guest-host";
import { createWebviewFilesClient, type WebviewFilesClient } from "./webview-files-client";

export type { WebviewFilesClient } from "./webview-files-client";

import type { PropsStore } from "./webview-props-store";

export type { PropsStore } from "./webview-props-store";

import { createWebviewPageClient, type WebviewPageClient } from "./webview-page-client";

export type { GuestHost } from "./guest-host";

export type ExtensionViewRenderContext<TProps = unknown> = {
  mount: HTMLElement;
  host: GuestHost;
  /** @deprecated Use createWebviewClient(host).files. */
  files: WebviewFilesClient;
  /** @deprecated Use createWebviewClient(host).page. */
  page: WebviewPageClient;
  propsStore: PropsStore<TProps>;
  locale: string;
  t: (key: string, defaultValue?: string, args?: Record<string, unknown>) => string;
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

const readTranslationProps = (props: unknown) => {
  const translations =
    typeof props === "object" && props !== null && "translations" in props
      ? (props as { translations?: unknown }).translations
      : undefined;
  if (typeof translations !== "object" || translations === null) return null;
  return translations as {
    bundle?: Record<string, string>;
    defaultBundle?: Record<string, string>;
    locale?: string;
  };
};

const interpolate = (value: string, args?: Record<string, unknown>) =>
  Object.entries(args ?? {}).reduce(
    (next, [key, replacement]) => next.replaceAll(`{{${key}}}`, String(replacement)),
    value,
  );

const createTranslationApi = <TProps>(propsStore: PropsStore<TProps>) => {
  const locale = () => readTranslationProps(propsStore.get())?.locale ?? "en";
  const t = (key: string, defaultValue?: string, args?: Record<string, unknown>) => {
    const translations = readTranslationProps(propsStore.get());
    const value = translations?.bundle?.[key] ?? translations?.defaultBundle?.[key] ?? defaultValue ?? key;
    return interpolate(value, args);
  };

  return { locale, t };
};

export const defineExtensionView = <TProps = WebviewHostProps>(definition: {
  render: ExtensionViewRender<TProps>;
}): ExtensionViewModule<TProps> => ({
  mount: async (mount, host, propsStore) => {
    const translations = createTranslationApi(propsStore);
    const cleanup = await definition.render({
      mount,
      host,
      files: createWebviewFilesClient(host),
      page: createWebviewPageClient(host, propsStore),
      propsStore,
      get locale() {
        return translations.locale();
      },
      t: translations.t,
    });
    return typeof cleanup === "function" ? cleanup : () => {};
  },
});
