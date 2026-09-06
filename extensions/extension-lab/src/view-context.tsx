import type { GuestHost, NavigationTarget, PageLocation, PropsStore, ResourceRef } from "@pstdio/sdk/extensions";
import { createContext, useContext, useSyncExternalStore } from "react";

export interface ExampleProps {
  projectId?: string;
  resource?: ResourceRef;
  pageLocation?: PageLocation;
  lastCommand?: {
    commandId: string;
    extensionId: string;
    outcome: { ok: boolean; value?: unknown };
    tick: number;
  } | null;
}
export interface ExampleHost {
  navigate(target: NavigationTarget): Promise<unknown>;
  getResource(): ResourceRef | undefined;
  subscribeResource(listener: () => void): () => void;
  bridge: GuestHost;
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
  navigate: (target) => bridge.call("navigation.open", { target }),
  getResource: () => props.get().pageLocation?.resource,
  subscribeResource: (listener) => props.subscribe(listener),
});
export const usePageResource = (host: ExampleHost) =>
  useSyncExternalStore(host.subscribeResource, host.getResource, host.getResource);
