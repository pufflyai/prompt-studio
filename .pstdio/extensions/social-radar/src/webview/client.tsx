import type { createWebviewClient, GuestHost, PropsStore, ResourceRef } from "@pstdio/sdk/extensions";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import type { commands } from "../commands";
import { radarChanged } from "../store";

export type RadarClient = ReturnType<typeof createWebviewClient<typeof commands>>;
interface RadarContextValue {
  host: GuestHost;
  client: RadarClient;
  propsStore: PropsStore<{ resource?: ResourceRef }>;
}
export const RadarContext = createContext<RadarContextValue | null>(null);

export const useRadar = () => {
  const value = useContext(RadarContext);
  if (!value) throw new Error("Social radar needs the extension host.");
  return value;
};
export const useRadarResource = () => {
  const { propsStore } = useRadar();
  return useSyncExternalStore(propsStore.subscribe, propsStore.get, propsStore.get).resource;
};
/** Refetches every query when a command reports a change, instead of polling. */
export const useRadarRefresh = () => {
  const { client } = useRadar();
  const queryClient = useQueryClient();
  useEffect(
    () => client.events.subscribe(radarChanged, () => void queryClient.invalidateQueries()),
    [client, queryClient],
  );
};
export const useOpenThread = () => {
  const { host } = useRadar();
  return (resource: ResourceRef) =>
    host.call("navigation.open", { target: { kind: "page", page: { kind: "page", id: "thread" }, resource } });
};
// A link inside the sandboxed webview opens a sandboxed tab where sites cannot run, so the host opens it.
export const useOpenLink = () => {
  const { host } = useRadar();
  return (href: string) => host.call("navigation.open", { target: { kind: "href", href } });
};
