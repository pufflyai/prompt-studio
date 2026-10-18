import type { PageLocation, PageParams, PageParamValue } from "pstdio-api-contracts/extension-kernel";
import type { PropsStore } from "./define-extension-view";
import type { GuestHost } from "./guest-host";

export interface WebviewPageClient {
  location(): PageLocation | undefined;
  params<T extends Record<string, PageParamValue> = Record<string, PageParamValue>>(): T;
  subscribe(listener: (location: PageLocation | undefined) => void): () => void;
  updateParams(params: Readonly<Record<string, PageParamValue | null>>): Promise<PageLocation>;
}

export const createWebviewPageClient = <TProps>(
  host: GuestHost,
  propsStore:
    | PropsStore<TProps>
    | PropsStore<import("pstdio-api-contracts/extension-kernel").WebviewHostProps>
    | undefined = host.propsStore,
): WebviewPageClient => {
  const props = () => propsStore?.get() as { pageLocation?: PageLocation; pageParams?: PageParams } | undefined;
  return {
    location: () => props()?.pageLocation,
    params: <T extends Record<string, PageParamValue>>() => (props()?.pageParams ?? {}) as T,
    subscribe: (listener) => propsStore?.subscribe(() => listener(props()?.pageLocation)) ?? (() => {}),
    updateParams: async (params) => (await host.call("page.params.update", { params })).location,
  };
};
