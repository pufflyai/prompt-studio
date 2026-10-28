import {
  createWebviewClient,
  type GuestHost,
  type NavigationTarget,
  type PageLocation,
  type PageParams,
  type PropsStore,
  type ResourceRef,
  type WebviewPageClient,
} from "@pstdio/sdk/extensions";
import { createContext, useContext, useSyncExternalStore } from "react";

export interface ExampleProps {
  projectId?: string;
  resource?: ResourceRef;
  pageLocation?: PageLocation;
  pageParams?: PageParams;
}
export interface ExampleHost {
  navigate(target: NavigationTarget): Promise<unknown>;
  getResource(): ResourceRef | undefined;
  subscribeResource(listener: () => void): () => void;
  bridge: GuestHost;
  page: WebviewPageClient;
}
export interface ExampleViewInput {
  host: ExampleHost;
  resource?: ResourceRef;
}
export const ViewContext = createContext<ExampleViewInput | null>(null);
export const useExampleView = () => {
  const context = useContext(ViewContext);
  if (!context) throw new Error("Example view context is missing");
  return context;
};
export const createExampleHost = (bridge: GuestHost, props: PropsStore<ExampleProps>): ExampleHost => ({
  bridge,
  page: createWebviewClient(bridge).page,
  navigate: (target) => bridge.call("navigation.open", { target }),
  getResource: () => props.get().pageLocation?.resource,
  subscribeResource: (listener) => props.subscribe(listener),
});
export const usePageResource = (host: ExampleHost) =>
  useSyncExternalStore(host.subscribeResource, host.getResource, host.getResource);

export const pageSelection = (host: ExampleHost) => {
  const value = host.page.params().selection;
  return typeof value === "string" ? value : undefined;
};
export const usePageSelection = (host: ExampleHost) =>
  useSyncExternalStore(
    host.page.subscribe,
    () => pageSelection(host),
    () => pageSelection(host),
  );
